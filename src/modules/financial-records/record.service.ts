import { RecordRepository } from './record.repository.js';
import { withTransaction } from '../../shared/transaction.js';
import { logAudit } from '../../shared/audit.service.js';
import { Money } from '../../shared/money.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { FinancialRecord, RecordFilters, PaginationMeta } from '../../types/index.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * Financial Record Service — Business logic with atomic transactions.
 * Every mutation is wrapped in a transaction with audit logging.
 * All money operations use decimal-safe arithmetic.
 */
export class RecordService {
  /**
   * Create a financial record (atomic + audit)
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
    ipAddress?: string,
    userAgent?: string
  ): Promise<FinancialRecord> {
    // Validate money amount using decimal-safe library
    const money = Money.from(data.amount);
    if (!money.isPositive()) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be positive');
    }

    return withTransaction(async (client) => {
      const record = await RecordRepository.create(
        { ...data, amount: money.toFixed() },
        client
      );

      await logAudit(client, {
        entity: 'financial_record',
        entityId: record.id,
        action: 'CREATE',
        oldValues: null,
        newValues: record as unknown as Record<string, unknown>,
        ipAddress,
        userAgent,
      });

      // Invalidate dashboard cache after mutation
      await DashboardService.invalidateCache();
      return record;
    });
  }

  /**
   * Get record by ID (with scope check)
   */
  static async getById(id: string, scopeDepartment?: string): Promise<FinancialRecord> {
    const record = await RecordRepository.findById(id, scopeDepartment);
    if (!record) {
      throw new AppError(404, 'NOT_FOUND', 'Financial record not found');
    }
    return record;
  }

  /**
   * List records with filtering and pagination
   */
  static async list(
    filters: RecordFilters,
    scopeDepartment?: string
  ): Promise<{ records: FinancialRecord[]; pagination: PaginationMeta }> {
    const { records, total } = await RecordRepository.findAll({
      ...filters,
      scopeDepartment,
    });

    const page = filters.page || 1;
    const limit = filters.limit || 20;

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update a financial record (atomic + audit)
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
    scopeDepartment?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FinancialRecord> {
    // Validate money if provided
    if (data.amount) {
      const money = Money.from(data.amount);
      if (!money.isPositive()) {
        throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be positive');
      }
      data.amount = money.toFixed();
    }

    return withTransaction(async (client) => {
      // Get current state for audit diff
      const oldRecord = await RecordRepository.findById(id, scopeDepartment, client);
      if (!oldRecord) {
        throw new AppError(404, 'NOT_FOUND', 'Financial record not found');
      }

      const updated = await RecordRepository.update(id, data, updatedBy, client);
      if (!updated) {
        throw new AppError(404, 'NOT_FOUND', 'Financial record not found');
      }

      await logAudit(client, {
        entity: 'financial_record',
        entityId: id,
        action: 'UPDATE',
        oldValues: oldRecord as unknown as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        ipAddress,
        userAgent,
      });

      await DashboardService.invalidateCache();
      return updated;
    });
  }

  /**
   * Soft delete a financial record (atomic + audit)
   */
  static async delete(
    id: string,
    scopeDepartment?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    return withTransaction(async (client) => {
      const oldRecord = await RecordRepository.findById(id, scopeDepartment, client);
      if (!oldRecord) {
        throw new AppError(404, 'NOT_FOUND', 'Financial record not found');
      }

      const deleted = await RecordRepository.softDelete(id, client);
      if (!deleted) {
        throw new AppError(404, 'NOT_FOUND', 'Financial record not found');
      }

      await logAudit(client, {
        entity: 'financial_record',
        entityId: id,
        action: 'DELETE',
        oldValues: oldRecord as unknown as Record<string, unknown>,
        newValues: null,
        ipAddress,
        userAgent,
      });

      await DashboardService.invalidateCache();
    });
  }
}
