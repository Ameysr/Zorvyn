import pool from '../../config/database.js';
import { FinancialRecord, RecordFilters } from '../../types/index.js';
import { PoolClient } from 'pg';

/**
 * Financial Record Repository — Data access layer.
 * All queries respect soft-delete (WHERE deleted_at IS NULL).
 * Department scoping is injected by the service layer.
 */
export class RecordRepository {
  /**
   * Create a financial record
   */
  static async create(
    data: {
      amount: string;
      type: string;
      category: string;
      description?: string;
      date: string;
      department: string;
      created_by: string;
    },
    client: PoolClient
  ): Promise<FinancialRecord> {
    const { rows } = await client.query(
      `INSERT INTO financial_records (amount, type, category, description, date, department, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [data.amount, data.type, data.category, data.description || null, data.date, data.department, data.created_by]
    );
    return rows[0];
  }

  /**
   * Find record by ID with optional department scope
   */
  static async findById(id: string, department?: string, client?: PoolClient): Promise<FinancialRecord | null> {
    const db = client || pool;
    let query = 'SELECT * FROM financial_records WHERE id = $1 AND deleted_at IS NULL';
    const params: unknown[] = [id];

    if (department) {
      query += ' AND department = $2';
      params.push(department);
    }

    const { rows } = await db.query(query, params);
    return rows[0] || null;
  }

  /**
   * List records with filtering, pagination, and department scoping
   */
  static async findAll(filters: RecordFilters & { scopeDepartment?: string }): Promise<{ records: FinancialRecord[]; total: number }> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Department scope (injected by middleware)
    if (filters.scopeDepartment) {
      conditions.push(`department = $${paramIndex++}`);
      params.push(filters.scopeDepartment);
    }

    // User-facing filters
    if (filters.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(filters.type);
    }
    if (filters.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(filters.category);
    }
    if (filters.dateFrom) {
      conditions.push(`date >= $${paramIndex++}`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push(`date <= $${paramIndex++}`);
      params.push(filters.dateTo);
    }

    const where = conditions.join(' AND ');
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM financial_records WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Fetch paginated results
    const allowedSorts = ['date', 'amount', 'created_at', 'category'];
    const sort = allowedSorts.includes(filters.sort || '') ? filters.sort : 'date';
    const order = filters.order === 'asc' ? 'ASC' : 'DESC';

    const { rows } = await pool.query(
      `SELECT * FROM financial_records WHERE ${where}
       ORDER BY ${sort} ${order}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return { records: rows, total };
  }

  /**
   * Update record
   */
  static async update(
    id: string,
    data: Partial<{
      amount: string;
      type: string;
      category: string;
      description: string;
      date: string;
    }>,
    updatedBy: string,
    client: PoolClient
  ): Promise<FinancialRecord | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      params.push(data.amount);
    }
    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      params.push(data.type);
    }
    if (data.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      params.push(data.category);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.date !== undefined) {
      fields.push(`date = $${paramIndex++}`);
      params.push(data.date);
    }

    fields.push(`updated_by = $${paramIndex++}`);
    params.push(updatedBy);
    fields.push(`updated_at = NOW()`);

    const { rows } = await client.query(
      `UPDATE financial_records SET ${fields.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      [...params, id]
    );

    return rows[0] || null;
  }

  /**
   * Soft delete record
   */
  static async softDelete(id: string, client: PoolClient): Promise<boolean> {
    const { rowCount } = await client.query(
      `UPDATE financial_records SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (rowCount ?? 0) > 0;
  }
}
