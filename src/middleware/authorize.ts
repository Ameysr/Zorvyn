import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import { ApiResponseHelper } from '../shared/apiResponse.js';
import { logger } from '../shared/logger.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Restricts endpoint access based on user roles.
 * Must be used AFTER authenticate middleware.
 * 
 * Role Hierarchy:
 *   viewer  → read-only access to own department data
 *   analyst → read access + dashboard analytics
 *   admin   → full CRUD + user management + cross-department
 * 
 * Usage:
 *   router.get('/records', authenticate, authorize('viewer', 'analyst', 'admin'), handler)
 *   router.post('/records', authenticate, authorize('admin'), handler)
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      ApiResponseHelper.unauthorized(res, 'Authentication required');
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn(
        {
          userId: user.userId,
          role: user.role,
          requiredRoles: allowedRoles,
          method: req.method,
          url: req.originalUrl,
        },
        `Access denied: role '${user.role}' not in [${allowedRoles.join(', ')}]`
      );
      ApiResponseHelper.forbidden(res, `Role '${user.role}' does not have access to this resource`);
      return;
    }

    next();
  };
}
