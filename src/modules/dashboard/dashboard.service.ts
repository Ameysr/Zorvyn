import { DashboardRepository } from './dashboard.repository.js';
import redis from '../../config/redis.js';
import { logger } from '../../shared/logger.js';

const CACHE_TTL = 60; // 60 seconds
const CACHE_PREFIX = 'dashboard';

/**
 * Dashboard Service — Business logic for analytics.
 * Implements Redis caching with 60-second TTL.
 * Cache is invalidated on any financial record mutation.
 */
export class DashboardService {
  /**
   * Get cached or fresh summary
   */
  static async getSummary(department?: string) {
    const cacheKey = `${CACHE_PREFIX}:summary:${department || 'all'}`;
    return DashboardService.getCachedOrFetch(cacheKey, () =>
      DashboardRepository.getSummary(department)
    );
  }

  /**
   * Get cached or fresh category breakdown
   */
  static async getCategoryBreakdown(department?: string) {
    const cacheKey = `${CACHE_PREFIX}:categories:${department || 'all'}`;
    return DashboardService.getCachedOrFetch(cacheKey, () =>
      DashboardRepository.getCategoryBreakdown(department)
    );
  }

  /**
   * Get cached or fresh monthly trends
   */
  static async getMonthlyTrends(department?: string) {
    const cacheKey = `${CACHE_PREFIX}:trends:${department || 'all'}`;
    return DashboardService.getCachedOrFetch(cacheKey, () =>
      DashboardRepository.getMonthlyTrends(department)
    );
  }

  /**
   * Recent activity — no cache (must be real-time)
   */
  static async getRecentActivity(limit: number = 10, department?: string) {
    return DashboardRepository.getRecentActivity(limit, department);
  }

  /**
   * Invalidate all dashboard caches.
   * Called after every financial record mutation (create, update, delete).
   */
  static async invalidateCache(): Promise<void> {
    try {
      const keys = await redis.keys(`${CACHE_PREFIX}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug({ keysInvalidated: keys.length }, 'Dashboard cache invalidated');
      }
    } catch (error) {
      // Fail silently — cache miss is acceptable
      logger.warn({ err: error }, 'Failed to invalidate dashboard cache');
    }
  }

  /**
   * Generic cache-or-fetch pattern.
   * 1. Check Redis for cached value
   * 2. If miss, fetch from DB and cache the result
   * 3. If Redis is unavailable, fall through to DB
   */
  private static async getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        logger.debug({ key }, 'Dashboard cache HIT');
        return JSON.parse(cached);
      }
    } catch (error) {
      // Redis down — continue to DB
      logger.warn({ err: error, key }, 'Redis cache read failed — falling through to DB');
    }

    // Cache miss — fetch from database
    const data = await fetcher();

    // Store in cache (fire-and-forget)
    try {
      await redis.setex(key, CACHE_TTL, JSON.stringify(data));
      logger.debug({ key, ttl: CACHE_TTL }, 'Dashboard cache SET');
    } catch (error) {
      logger.warn({ err: error, key }, 'Redis cache write failed');
    }

    return data;
  }
}
