import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service.js';
import { ApiResponseHelper } from '../../shared/apiResponse.js';

export class UserController {
  /**
   * GET /api/v1/users
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, role, status, department, sort, order } = req.query as any;
      const result = await UserService.list({ page, limit, role, status, department, sort, order });

      ApiResponseHelper.paginated(res, result.users, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserService.getById(req.params.id);
      ApiResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/users/:id
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserService.update(req.params.id, req.body, req.ip, req.get('user-agent'));
      ApiResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/users/:id/role
   */
  static async changeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserService.changeRole(req.params.id, req.body.role, req.ip, req.get('user-agent'));
      ApiResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/users/:id/status
   */
  static async changeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserService.changeStatus(req.params.id, req.body.status, req.ip, req.get('user-agent'));
      ApiResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/users/:id
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await UserService.delete(req.params.id, req.ip, req.get('user-agent'));
      ApiResponseHelper.success(res, { message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
