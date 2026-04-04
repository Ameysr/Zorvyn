import { UserRepository } from './user.repository.js';
import { withTransaction } from '../../shared/transaction.js';
import { logAudit } from '../../shared/audit.service.js';
import { UserPublic, PaginationMeta } from '../../types/index.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * User Service — Business logic for user management.
 * All mutations are wrapped in atomic transactions with audit logging.
 */
export class UserService {
  /**
   * Get user by ID
   */
  static async getById(id: string): Promise<UserPublic> {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }
    return user;
  }

  /**
   * List users with filtering and pagination
   */
  static async list(filters: {
    page: number;
    limit: number;
    role?: string;
    status?: string;
    department?: string;
    sort: string;
    order: string;
  }): Promise<{ users: UserPublic[]; pagination: PaginationMeta }> {
    const { users, total } = await UserRepository.findAll(filters);

    return {
      users,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  /**
   * Update user profile (within atomic transaction + audit)
   */
  static async update(
    id: string,
    data: Partial<{ full_name: string; email: string; department: string }>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserPublic> {
    return withTransaction(async (client) => {
      // Get current state for audit diff
      const oldUser = await UserRepository.findFullById(id, client);
      if (!oldUser) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      // Check email uniqueness if changing email
      if (data.email) {
        const existing = await UserRepository.findByEmail(data.email);
        if (existing && existing.id !== id) {
          throw new AppError(409, 'CONFLICT', 'Email already in use');
        }
      }

      const updated = await UserRepository.update(id, data, client);
      if (!updated) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      // Audit log with before/after diff
      await logAudit(client, {
        entity: 'user',
        entityId: id,
        action: 'UPDATE',
        oldValues: oldUser as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Change user role (admin only, atomic + audit)
   */
  static async changeRole(
    id: string,
    role: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserPublic> {
    return withTransaction(async (client) => {
      const oldUser = await UserRepository.findFullById(id, client);
      if (!oldUser) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      const updated = await UserRepository.updateRole(id, role, client);
      if (!updated) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      await logAudit(client, {
        entity: 'user',
        entityId: id,
        action: 'UPDATE',
        oldValues: oldUser as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Change user status (admin only, atomic + audit)
   */
  static async changeStatus(
    id: string,
    status: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserPublic> {
    return withTransaction(async (client) => {
      const oldUser = await UserRepository.findFullById(id, client);
      if (!oldUser) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      const updated = await UserRepository.updateStatus(id, status, client);
      if (!updated) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      await logAudit(client, {
        entity: 'user',
        entityId: id,
        action: 'UPDATE',
        oldValues: oldUser as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Soft delete user (admin only, atomic + audit)
   */
  static async delete(
    id: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    return withTransaction(async (client) => {
      const oldUser = await UserRepository.findFullById(id, client);
      if (!oldUser) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      const deleted = await UserRepository.softDelete(id, client);
      if (!deleted) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      await logAudit(client, {
        entity: 'user',
        entityId: id,
        action: 'DELETE',
        oldValues: oldUser as Record<string, unknown>,
        newValues: null,
        ipAddress,
        userAgent,
      });
    });
  }
}
