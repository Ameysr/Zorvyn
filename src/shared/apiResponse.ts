import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types/index.js';

/**
 * Standardized API response helpers.
 * Every response from Zorvyn follows the same shape:
 * { success, data?, error?, meta? }
 */
export class ApiResponseHelper {
  /**
   * 200 OK — Successful response with data
   */
  static success<T>(res: Response, data: T, statusCode = 200, meta?: Partial<PaginationMeta & { correlation_id: string }>): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      ...(meta && { meta }),
    };
    res.status(statusCode).json(response);
  }

  /**
   * 201 Created — Resource created successfully
   */
  static created<T>(res: Response, data: T): void {
    ApiResponseHelper.success(res, data, 201);
  }

  /**
   * Paginated response with meta information
   */
  static paginated<T>(res: Response, data: T[], pagination: PaginationMeta): void {
    const response: ApiResponse<T[]> = {
      success: true,
      data,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
    };
    res.status(200).json(response);
  }

  /**
   * Error response with structured error object
   */
  static error(res: Response, statusCode: number, code: string, message: string, details?: unknown): void {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    };
    res.status(statusCode).json(response);
  }

  /**
   * 400 Bad Request
   */
  static badRequest(res: Response, message: string, details?: unknown): void {
    ApiResponseHelper.error(res, 400, 'BAD_REQUEST', message, details);
  }

  /**
   * 401 Unauthorized
   */
  static unauthorized(res: Response, message = 'Authentication required'): void {
    ApiResponseHelper.error(res, 401, 'UNAUTHORIZED', message);
  }

  /**
   * 403 Forbidden
   */
  static forbidden(res: Response, message = 'Insufficient permissions'): void {
    ApiResponseHelper.error(res, 403, 'FORBIDDEN', message);
  }

  /**
   * 404 Not Found
   */
  static notFound(res: Response, message = 'Resource not found'): void {
    ApiResponseHelper.error(res, 404, 'NOT_FOUND', message);
  }

  /**
   * 409 Conflict (idempotency, duplicate)
   */
  static conflict(res: Response, message: string, details?: unknown): void {
    ApiResponseHelper.error(res, 409, 'CONFLICT', message, details);
  }

  /**
   * 429 Too Many Requests
   */
  static tooManyRequests(res: Response, message = 'Rate limit exceeded'): void {
    ApiResponseHelper.error(res, 429, 'RATE_LIMIT_EXCEEDED', message);
  }

  /**
   * 500 Internal Server Error
   */
  static internalError(res: Response, message = 'Internal server error'): void {
    ApiResponseHelper.error(res, 500, 'INTERNAL_ERROR', message);
  }
}
