import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncLocalStorage } from '../shared/logger.js';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * Correlation ID Middleware — End-to-End Request Tracing
 * 
 * WHY: In production, when a user reports "my transaction failed,"
 * you grep ONE ID and see the entire request lifecycle:
 * auth → validation → DB query → audit write → response.
 * 
 * HOW:
 * 1. Extract X-Correlation-ID from incoming request headers
 * 2. If missing, generate a new UUIDv4
 * 3. Store in AsyncLocalStorage (accessible across async boundaries)
 * 4. Set on response header X-Correlation-ID
 * 5. Every Pino log line automatically includes it
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();

  // Set on response header — client can use this for support tickets
  res.setHeader('X-Correlation-ID', correlationId);

  // Store in request object for middleware access
  (req as AuthenticatedRequest).correlationId = correlationId;

  // Store in AsyncLocalStorage — accessible everywhere without prop drilling
  const store = new Map<string, string>();
  store.set('correlationId', correlationId);

  asyncLocalStorage.run(store, () => {
    next();
  });
}
