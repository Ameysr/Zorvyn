import app from './app.js';
import config from './config/env.js';
import { runMigrations, closeDatabasePool } from './config/database.js';
import { closeRedisConnection } from './config/redis.js';
import { logger } from './shared/logger.js';
import http from 'http';

const server = http.createServer(app);

/**
 * Application Startup
 */
async function start(): Promise<void> {
  try {
    // Run database migrations
    logger.info('Running database migrations...');
    await runMigrations();
    logger.info('Database migrations complete');

    // Start HTTP server
    server.listen(config.port, () => {
      logger.info(`🚀 Zorvyn Finance Backend running on port ${config.port}`);
      logger.info(`📚 Environment: ${config.nodeEnv}`);
      if (!config.isProduction) {
        logger.info(`📖 Swagger UI: http://localhost:${config.port}/api/docs`);
        logger.info(`💚 Health: http://localhost:${config.port}/health`);
        logger.info(`✅ Ready: http://localhost:${config.port}/ready`);
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// ============================================
// Graceful Shutdown — Container & Kubernetes Ready
// ============================================
// WHY: Without graceful shutdown, you get 502s during deployments.
// Kubernetes sends SIGTERM → we stop accepting connections →
// finish in-flight requests → close DB/Redis pools → exit cleanly.

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`⚠️  ${signal} received — starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server.close(async () => {
    logger.info('✅ HTTP server closed — no new connections accepted');

    try {
      // 2. Close database pool (waits for in-flight queries)
      await closeDatabasePool();

      // 3. Close Redis connection
      await closeRedisConnection();

      logger.info('✅ All connections closed — shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, '❌ Error during shutdown');
      process.exit(1);
    }
  });

  // 4. Force exit after 30 seconds if shutdown hangs
  setTimeout(() => {
    logger.error('❌ Graceful shutdown timeout (30s) — forcing exit');
    process.exit(1);
  }, 30000);
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason: any) => {
  logger.error({ err: reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught Exception — shutting down');
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start the application
start();
