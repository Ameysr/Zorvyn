import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { AuthenticatedRequest, JwtPayload } from '../types/index.js';
import { ApiResponseHelper } from '../shared/apiResponse.js';
import { asyncLocalStorage } from '../shared/logger.js';

/**
 * JWT Authentication Middleware
 * 
 * Extracts and verifies the Bearer token from the Authorization header.
 * Populates req.user with the decoded JWT payload.
 * Also sets userId in AsyncLocalStorage for audit/logging.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ApiResponseHelper.unauthorized(res, 'Missing or invalid authorization header');
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;

    // Populate request with user data
    (req as AuthenticatedRequest).user = decoded;

    // Set userId in AsyncLocalStorage for audit trail
    const store = asyncLocalStorage.getStore();
    if (store) {
      store.set('userId', decoded.userId);
    }

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      ApiResponseHelper.unauthorized(res, 'Access token expired');
      return;
    }
    ApiResponseHelper.unauthorized(res, 'Invalid access token');
  }
}
