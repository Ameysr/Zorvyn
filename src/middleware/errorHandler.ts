import { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger.js';
import { ApiResponseHelper } from '../shared/apiResponse.js';

/**
 * Global Error Handler — Last line of defense
 * 
 * Catches all unhandled errors, logs them with correlationId,
 * and returns a consistent error response. Never leaks stack traces
 * or internal details in production.
 */
export function errorHandler(err: Error & { statusCode?: number; code?: string; details?: unknown }, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500 && process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      stack: err.stack,
    },
    `Error: ${err.message}`
  );

  // Never return stack traces in production
  const response: Record<string, unknown> = {
    success: false,
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Custom application error with status code
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}
