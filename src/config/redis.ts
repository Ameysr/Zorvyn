import Redis from 'ioredis';
import config from './env.js';
import { logger } from '../shared/logger.js';

const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  logger.debug('Redis client connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redis.on('close', () => {
  logger.debug('Redis connection closed');
});

/**
 * Check Redis connectivity (used by /ready probe)
 */
export async function checkRedisHealth(): Promise<{ connected: boolean; response?: string; error?: string }> {
  try {
    const pong = await redis.ping();
    return { connected: pong === 'PONG', response: pong };
  } catch (err: any) {
    logger.error({ err }, 'Redis health check failed');
    return { connected: false, error: err.message };
  }
}

/**
 * Close Redis connection gracefully (used during shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}

export default redis;
