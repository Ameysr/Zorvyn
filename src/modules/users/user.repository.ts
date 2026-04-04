import pool from '../../config/database.js';
import { UserPublic } from '../../types/index.js';
import { PoolClient } from 'pg';

/**
 * User Repository — Data access layer for users.
 * Controllers and services never write SQL directly.
 */
export class UserRepository {
  /**
   * Find user by ID (excludes soft-deleted)
   */
  static async findById(id: string, client?: PoolClient): Promise<UserPublic | null> {
    const db = client || pool;
    const { rows } = await db.query(
      `SELECT id, email, full_name, role, department, status, created_at, updated_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<UserPublic | null> {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, department, status, created_at, updated_at
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    return rows[0] || null;
  }

  /**
   * List users with filtering and pagination
   */
  static async findAll(filters: {
    page: number;
    limit: number;
    role?: string;
    status?: string;
    department?: string;
    sort: string;
    order: string;
  }): Promise<{ users: UserPublic[]; total: number }> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.role) {
      conditions.push(`role = $${paramIndex++}`);
      params.push(filters.role);
    }
    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters.department) {
      conditions.push(`department = $${paramIndex++}`);
      params.push(filters.department);
    }

    const where = conditions.join(' AND ');
    const offset = (filters.page - 1) * filters.limit;

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Fetch paginated results
    const allowedSorts = ['created_at', 'full_name', 'email'];
    const sort = allowedSorts.includes(filters.sort) ? filters.sort : 'created_at';
    const order = filters.order === 'asc' ? 'ASC' : 'DESC';

    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, department, status, created_at, updated_at
       FROM users WHERE ${where}
       ORDER BY ${sort} ${order}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, filters.limit, offset]
    );

    return { users: rows, total };
  }

  /**
   * Update user fields
   */
  static async update(
    id: string,
    data: Partial<{ full_name: string; email: string; department: string }>,
    client: PoolClient
  ): Promise<UserPublic | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.full_name) {
      fields.push(`full_name = $${paramIndex++}`);
      params.push(data.full_name);
    }
    if (data.email) {
      fields.push(`email = $${paramIndex++}`);
      params.push(data.email.toLowerCase());
    }
    if (data.department) {
      fields.push(`department = $${paramIndex++}`);
      params.push(data.department);
    }

    fields.push(`updated_at = NOW()`);

    const { rows } = await client.query(
      `UPDATE users SET ${fields.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, email, full_name, role, department, status, created_at, updated_at`,
      [...params, id]
    );

    return rows[0] || null;
  }

  /**
   * Update user role
   */
  static async updateRole(id: string, role: string, client: PoolClient): Promise<UserPublic | null> {
    const { rows } = await client.query(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email, full_name, role, department, status, created_at, updated_at`,
      [role, id]
    );
    return rows[0] || null;
  }

  /**
   * Update user status
   */
  static async updateStatus(id: string, status: string, client: PoolClient): Promise<UserPublic | null> {
    const { rows } = await client.query(
      `UPDATE users SET status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email, full_name, role, department, status, created_at, updated_at`,
      [status, id]
    );
    return rows[0] || null;
  }

  /**
   * Soft delete user
   */
  static async softDelete(id: string, client: PoolClient): Promise<boolean> {
    const { rowCount } = await client.query(
      `UPDATE users SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (rowCount ?? 0) > 0;
  }

  /**
   * Get full user data for audit (includes all fields)
   */
  static async findFullById(id: string, client?: PoolClient): Promise<Record<string, unknown> | null> {
    const db = client || pool;
    const { rows } = await db.query(
      `SELECT id, email, full_name, role, department, status, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }
}
