import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../shared/logger.js';

/**
 * Implicit Row-Level Data Scoping Middleware
 * 
 * WHY: Roles aren't enough. Real finance systems restrict data
 * by department/team/tenant. This middleware auto-injects scope
 * into every request, so controllers never manually filter.
 * 
 * HOW:
 * - Reads user.department from JWT claims
 * - If role === 'admin' → no filter (full cross-department access)
 * - Otherwise → sets req.scope.department = user.department
 * - Repository layer auto-appends: WHERE department = $scope
 * 
 * RESULT: Data leakage is architecturally impossible,
 * not just "hoped to be correct" at the controller level.
 */
export function scopeFilter(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user) {
    // No user means public route — no scope needed
    next();
    return;
  }

  if (user.role === 'admin') {
    // Admins have unrestricted access across all departments
    authReq.scope = {};
    logger.debug(
      { userId: user.userId, role: user.role },
      'Scope: admin — unrestricted access'
    );
  } else {
    // Non-admins are scoped to their department
    authReq.scope = {
      department: user.department,
    };
    logger.debug(
      { userId: user.userId, role: user.role, department: user.department },
      `Scope: restricted to department '${user.department}'`
    );
  }

  next();
}
