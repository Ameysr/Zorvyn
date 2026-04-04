import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis.js';
import pool from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { ApiResponseHelper } from '../shared/apiResponse.js';
import { logger } from '../shared/logger.js';

/**
 * Network-Resilient Idempotency Layer
 * 
 * WHY: Prevents duplicate financial entries from retries,
 * timeouts, or flaky networks. Critical for fintech.
 * 
 * FLOW:
 * 1. Client sends POST with X-Idempotency-Key header
 * 2. Check Redis first (fast path, sub-ms)
 * 3. If found → return cached response
 * 4. If not → check PostgreSQL (durable fallback)
 * 5. If new → mark as 'processing' and proceed
 * 6. On completion → cache in Redis (24h TTL) + update PostgreSQL
 * 
 * Only applies to POST endpoints (mutations).
 */

const IDEMPOTENCY_TTL = 86400; // 24 hours in seconds

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Only enforce on POST (create operations)
  if (req.method !== 'POST') {
    next();
    return;
  }

  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  // If no key provided, proceed normally (key is optional but recommended)
  if (!idempotencyKey) {
    next();
    return;
  }

  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.userId;

  if (!userId) {
    next();
    return;
  }

  const redisKey = `idempotency:${userId}:${idempotencyKey}`;

  try {
    // 1. Fast path: Check Redis cache
    const cached = await redis.get(redisKey);
    if (cached) {
      const cachedResponse = JSON.parse(cached);
      logger.info(
        { idempotencyKey, userId },
        'Idempotent request — returning cached response from Redis'
      );
      res.status(cachedResponse.statusCode).json(cachedResponse.body);
      return;
    }

    // 2. Slow path: Check PostgreSQL
    const { rows } = await pool.query(
      `SELECT status, response_code, response_body FROM idempotency_keys
       WHERE key = $1 AND user_id = $2 AND expires_at > NOW()`,
      [idempotencyKey, userId]
    );

    if (rows.length > 0) {
      const record = rows[0];

      if (record.status === 'processing') {
        // Another request is still processing this key
        ApiResponseHelper.conflict(res, 'Request is already being processed', { idempotencyKey });
        return;
      }

      if (record.status === 'completed') {
        // Return cached response
        logger.info(
          { idempotencyKey, userId },
          'Idempotent request — returning cached response from PostgreSQL'
        );

        // Re-cache in Redis for faster subsequent lookups
        await redis.setex(redisKey, IDEMPOTENCY_TTL, JSON.stringify({
          statusCode: record.response_code,
          body: record.response_body,
        }));

        res.status(record.response_code).json(record.response_body);
        return;
      }
    }

    // 3. New key — register as 'processing'
    await pool.query(
      `INSERT INTO idempotency_keys (key, user_id, method, path, status)
       VALUES ($1, $2, $3, $4, 'processing')
       ON CONFLICT (key) DO NOTHING`,
      [idempotencyKey, userId, req.method, req.originalUrl]
    );

    // 4. Intercept response to capture and cache it
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Cache the response asynchronously (don't block response)
      const statusCode = res.statusCode;
      const cacheData = { statusCode, body };

      // Update PostgreSQL
      pool.query(
        `UPDATE idempotency_keys 
         SET status = 'completed', response_code = $1, response_body = $2
         WHERE key = $3 AND user_id = $4`,
        [statusCode, JSON.stringify(body), idempotencyKey, userId]
      ).catch((err) => {
        logger.error({ err, idempotencyKey }, 'Failed to update idempotency record');
      });

      // Cache in Redis
      redis.setex(redisKey, IDEMPOTENCY_TTL, JSON.stringify(cacheData))
        .catch((err) => {
          logger.error({ err, idempotencyKey }, 'Failed to cache idempotency in Redis');
        });

      return originalJson(body);
    } as any;

    next();
  } catch (error) {
    // If idempotency check fails, log and proceed (fail-open)
    logger.error({ err: error, idempotencyKey }, 'Idempotency check failed — proceeding');
    next();
  }
}
