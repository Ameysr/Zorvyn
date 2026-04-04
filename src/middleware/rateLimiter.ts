import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis.js';
import config from '../config/env.js';
import { ApiResponseHelper } from '../shared/apiResponse.js';
import { logger } from '../shared/logger.js';

/**
 * Redis-Backed Rate Limiter Middleware
 * 
 * Sliding window rate limiter using Redis.
 * Prevents API abuse without blocking legitimate traffic.
 * 
 * Headers returned:
 *   X-RateLimit-Limit: max requests per window
 *   X-RateLimit-Remaining: requests left
 *   X-RateLimit-Reset: timestamp when window resets
 */
export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = `rate_limit:${req.ip}`;
    const windowMs = config.rateLimit.windowMs;
    const maxRequests = config.rateLimit.maxRequests;

    const current = await redis.incr(key);

    if (current === 1) {
      // First request in window — set expiry
      await redis.pexpire(key, windowMs);
    }

    const ttl = await redis.pttl(key);
    const resetTime = Date.now() + (ttl > 0 ? ttl : windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    if (current > maxRequests) {
      logger.warn({ ip: req.ip, current, maxRequests }, 'Rate limit exceeded');
      res.setHeader('Retry-After', Math.ceil((ttl > 0 ? ttl : windowMs) / 1000));
      ApiResponseHelper.tooManyRequests(res, 'Too many requests. Please try again later.');
      return;
    }

    next();
  } catch (error) {
    // If Redis is down, allow the request (fail-open for availability)
    logger.error({ err: error }, 'Rate limiter error — failing open');
    next();
  }
}
