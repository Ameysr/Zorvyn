import { Request, Response, NextFunction } from 'express';
import { RecordService } from './record.service.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { ApiResponseHelper } from '../../shared/apiResponse.js';

export class RecordController {
  /**
   * POST /api/v1/records
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user!;

      const record = await RecordService.create(
        {
          ...req.body,
          department: req.body.department || user.department,
          created_by: user.userId,
        },
        req.ip,
        req.get('user-agent')
      );

      ApiResponseHelper.created(res, record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/records
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const scopeDepartment = authReq.scope?.department;

      const result = await RecordService.list(req.query as any, scopeDepartment);

      ApiResponseHelper.paginated(res, result.records, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/records/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const scopeDepartment = authReq.scope?.department;

      const record = await RecordService.getById(req.params.id as string, scopeDepartment);
      ApiResponseHelper.success(res, record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/records/:id
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const record = await RecordService.update(
        req.params.id as string,
        req.body,
        authReq.user!.userId,
        authReq.scope?.department,
        req.ip,
        req.get('user-agent')
      );

      ApiResponseHelper.success(res, record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/records/:id
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      await RecordService.delete(
        req.params.id as string,
        authReq.scope?.department,
        req.ip,
        req.get('user-agent')
      );

      ApiResponseHelper.success(res, { message: 'Record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/records/export
   * Export all visible records as CSV
   */
  static async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const scopeDepartment = authReq.scope?.department;

      // Fetch all records (no pagination cap for export)
      const result = await RecordService.list(
        {
          type: req.query.type as any,
          category: req.query.category as string,
          dateFrom: req.query.date_from as string,
          dateTo: req.query.date_to as string,
          page: 1,
          limit: 10000,
        },
        scopeDepartment
      );

      // Build CSV
      const headers = ['id', 'date', 'type', 'category', 'amount', 'description', 'department', 'created_by', 'created_at'];
      const csvRows = [headers.join(',')];

      for (const record of result.records) {
        const row = [
          record.id,
          record.date,
          record.type,
          record.category,
          record.amount,
          `"${(record.description || '').replace(/"/g, '""')}"`,
          record.department,
          record.created_by,
          new Date(record.created_at).toISOString(),
        ];
        csvRows.push(row.join(','));
      }

      const csv = csvRows.join('\n');
      const filename = `zorvyn_records_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}
