import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

import config from './config/env.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { checkDatabaseHealth } from './config/database.js';
import { checkRedisHealth } from './config/redis.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import recordRoutes from './modules/financial-records/record.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';

const app = express();

// ============================================
// Security Middleware
// ============================================
app.use(helmet());
app.use(cors({
  origin: config.isProduction ? [] : '*',
  credentials: true,
  exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));

// ============================================
// Body Parsing
// ============================================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// Core Middleware Pipeline
// (Order matters: correlation ID → logging → rate limiting)
// ============================================
app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(rateLimiter);

// ============================================
// Health & Readiness Probes (no auth required)
// ============================================

/**
 * GET /health — Liveness probe
 * Returns 200 if the process is alive.
 * Used by Kubernetes/Docker for liveness checks.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready — Readiness probe
 * Returns 200 only if DB and Redis are connected.
 * Used by Kubernetes/Docker to know when to route traffic.
 */
app.get('/ready', async (_req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const isReady = dbHealth.connected && redisHealth.connected;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks: {
      database: dbHealth,
      redis: redisHealth,
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Swagger UI (development only)
// ============================================
if (!config.isProduction) {
  const openapiPath = path.join(process.cwd(), 'openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const swaggerDoc = YAML.load(openapiPath);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Zorvyn Finance API',
    }));
  }
}

// ============================================
// API Routes — All prefixed with /api/v1/
// ============================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/records', recordRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/audit-logs', auditRoutes);

// ============================================
// 404 Handler
// ============================================
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

// ============================================
// Global Error Handler (must be last)
// ============================================
app.use(errorHandler);

export default app;
