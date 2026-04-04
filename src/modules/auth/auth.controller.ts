import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { ApiResponseHelper } from '../../shared/apiResponse.js';

export class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, full_name, department } = req.body;
      const result = await AuthService.register({ email, password, full_name, department });

      ApiResponseHelper.created(res, {
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);

      ApiResponseHelper.success(res, {
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refreshToken(refreshToken);

      ApiResponseHelper.success(res, { tokens });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await AuthService.getProfile(authReq.user!.userId);
      ApiResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { refreshToken } = req.body;
      const userId = authReq.user!.userId;

      await AuthService.logout(refreshToken, userId);

      ApiResponseHelper.success(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
}
