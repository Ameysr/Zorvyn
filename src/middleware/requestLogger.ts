import { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger.js';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * HTTP Request Logger Middleware — Structured Logging
 * 
 * Logs every request with: method, URL, status, duration, correlationId, userId.
 * Sensitive headers (Authorization) are redacted by Pino config.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const authReq = req as AuthenticatedRequest;

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
      userAgent: req.get('user-agent'),
      ip: req.ip,
      correlationId: authReq.correlationId,
      userId: authReq.user?.userId,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, `${req.method} ${req.originalUrl} ${res.statusCode} — ${duration}ms`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `${req.method} ${req.originalUrl} ${res.statusCode} — ${duration}ms`);
    } else {
      logger.info(logData, `${req.method} ${req.originalUrl} ${res.statusCode} — ${duration}ms`);
    }
  });

  next();
}
