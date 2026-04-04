import { Request } from 'express';

// ============================================
// User & Auth Types
// ============================================

export type UserRole = 'viewer' | 'analyst' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  department: string;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserPublic {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  department: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ============================================
// Financial Record Types
// ============================================

export type RecordType = 'income' | 'expense' | 'transfer';

export interface FinancialRecord {
  id: string;
  amount: string; // NUMERIC stored as string — never float
  type: RecordType;
  category: string;
  description: string | null;
  date: string;
  department: string;
  created_by: string;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface RecordFilters {
  type?: RecordType;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardSummary {
  total_income: string;
  total_expenses: string;
  net_balance: string;
  record_count: number;
}

export interface CategoryBreakdown {
  category: string;
  type: RecordType;
  total: string;
  count: number;
}

export interface TrendData {
  period: string;
  income: string;
  expenses: string;
  net: string;
}

// ============================================
// Audit Types
// ============================================

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditEntry {
  id: string;
  entity: string;
  entity_id: string;
  action: AuditAction;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_id: string;
  correlation_id: string;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: Date;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    correlation_id?: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// Request Extensions
// ============================================

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  correlationId?: string;
  scope?: {
    department?: string;
  };
}

// ============================================
// Idempotency Types
// ============================================

export interface IdempotencyRecord {
  key: string;
  user_id: string;
  method: string;
  path: string;
  status: 'processing' | 'completed' | 'failed';
  response_code: number | null;
  response_body: unknown;
  created_at: Date;
  expires_at: Date;
}
