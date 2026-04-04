/**
 * Migration Runner Script
 * Usage: npm run migrate
 */
import { runMigrations, closeDatabasePool } from '../src/config/database.js';
import { closeRedisConnection } from '../src/config/redis.js';
import { logger } from '../src/shared/logger.js';

async function main() {
  try {
    logger.info('🔄 Running database migrations...');
    await runMigrations();
    logger.info('✅ All migrations applied successfully');
  } catch (error) {
    logger.error({ err: error }, '❌ Migration failed');
    process.exit(1);
  } finally {
    await closeDatabasePool();
    await closeRedisConnection();
    process.exit(0);
  }
}

main();
