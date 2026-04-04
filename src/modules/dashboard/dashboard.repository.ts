import pool from '../../config/database.js';
import { DashboardSummary, CategoryBreakdown, TrendData } from '../../types/index.js';

/**
 * Dashboard Repository — Aggregation queries for analytics.
 * All queries respect soft-delete and department scoping.
 */
export class DashboardRepository {
  /**
   * Get total income, expenses, and net balance
   */
  static async getSummary(department?: string): Promise<DashboardSummary> {
    let where = 'deleted_at IS NULL';
    const params: unknown[] = [];

    if (department) {
      where += ' AND department = $1';
      params.push(department);
    }

    const { rows } = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::text AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::text AS total_expenses,
        COALESCE(
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) -
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0
        )::text AS net_balance,
        COUNT(*)::int AS record_count
       FROM financial_records
       WHERE ${where}`,
      params
    );

    return rows[0];
  }

  /**
   * Get category-wise totals
   */
  static async getCategoryBreakdown(department?: string): Promise<CategoryBreakdown[]> {
    let where = 'deleted_at IS NULL';
    const params: unknown[] = [];

    if (department) {
      where += ' AND department = $1';
      params.push(department);
    }

    const { rows } = await pool.query(
      `SELECT
        category,
        type,
        SUM(amount)::text AS total,
        COUNT(*)::int AS count
       FROM financial_records
       WHERE ${where}
       GROUP BY category, type
       ORDER BY total DESC`,
      params
    );

    return rows;
  }

  /**
   * Get monthly trends (last 12 months)
   */
  static async getMonthlyTrends(department?: string): Promise<TrendData[]> {
    let where = 'deleted_at IS NULL';
    const params: unknown[] = [];

    if (department) {
      where += ' AND department = $1';
      params.push(department);
    }

    const { rows } = await pool.query(
      `SELECT
        TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS period,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::text AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::text AS expenses,
        COALESCE(
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) -
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0
        )::text AS net
       FROM financial_records
       WHERE ${where} AND date >= NOW() - INTERVAL '12 months'
       GROUP BY date_trunc('month', date)
       ORDER BY period ASC`,
      params
    );

    return rows;
  }

  /**
   * Get recent activity (last N records)
   */
  static async getRecentActivity(limit: number = 10, department?: string): Promise<unknown[]> {
    let where = 'fr.deleted_at IS NULL';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (department) {
      where += ` AND fr.department = $${paramIndex++}`;
      params.push(department);
    }

    const { rows } = await pool.query(
      `SELECT 
        fr.id, fr.amount::text, fr.type, fr.category, fr.description,
        fr.date, fr.department, fr.created_at,
        u.full_name AS created_by_name
       FROM financial_records fr
       LEFT JOIN users u ON fr.created_by = u.id
       WHERE ${where}
       ORDER BY fr.created_at DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    return rows;
  }
}
