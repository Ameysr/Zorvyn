import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { ApiResponseHelper } from '../../shared/apiResponse.js';

export class DashboardController {
  /**
   * GET /api/v1/dashboard/summary
   */
  static async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const data = await DashboardService.getSummary(authReq.scope?.department);
      ApiResponseHelper.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/category-breakdown
   */
  static async categoryBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const data = await DashboardService.getCategoryBreakdown(authReq.scope?.department);
      ApiResponseHelper.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/trends
   */
  static async trends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const data = await DashboardService.getMonthlyTrends(authReq.scope?.department);
      ApiResponseHelper.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/recent-activity
   */
  static async recentActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const limit = parseInt(req.query.limit as string) || 10;
      const data = await DashboardService.getRecentActivity(limit, authReq.scope?.department);
      ApiResponseHelper.success(res, data);
    } catch (error) {
      next(error);
    }
  }
}
