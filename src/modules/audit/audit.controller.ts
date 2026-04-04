import { Request, Response, NextFunction } from 'express';
import pool from '../../config/database.js';
import { ApiResponseHelper } from '../../shared/apiResponse.js';

/**
 * Audit Controller — Read-only access to the immutable audit trail.
 * Only admins can view audit logs.
 */
export class AuditController {
  /**
   * GET /api/v1/audit-logs
   * List all audit entries, newest first, with pagination.
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      // Optional filters
      const entity = req.query.entity as string;
      const action = req.query.action as string;
      const userId = req.query.user_id as string;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (entity) {
        conditions.push(`entity = $${paramIndex++}`);
        params.push(entity);
      }
      if (action) {
        conditions.push(`action = $${paramIndex++}`);
        params.push(action.toUpperCase());
      }
      if (userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(userId);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM audit_log ${where}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Fetch with user join for readable output
      const { rows } = await pool.query(
        `SELECT a.id, a.entity, a.entity_id, a.action,
                a.old_values, a.new_values,
                a.user_id, u.email AS user_email, u.full_name AS user_name,
                a.correlation_id, a.ip_address, a.user_agent, a.timestamp
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id::uuid
         ${where}
         ORDER BY a.timestamp DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
      );

      ApiResponseHelper.paginated(res, rows, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/audit-logs/:entityId
   * Get full audit history for a specific entity (record).
   */
  static async getByEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityId } = req.params;
      const entity = (req.query.entity as string) || 'financial_record';

      const { rows } = await pool.query(
        `SELECT a.id, a.entity, a.entity_id, a.action,
                a.old_values, a.new_values,
                a.user_id, u.email AS user_email, u.full_name AS user_name,
                a.correlation_id, a.timestamp
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id::uuid
         WHERE a.entity = $1 AND a.entity_id = $2
         ORDER BY a.timestamp DESC
         LIMIT 100`,
        [entity, entityId]
      );

      ApiResponseHelper.success(res, rows);
    } catch (error) {
      next(error);
    }
  }
}
