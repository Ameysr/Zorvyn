import { PoolClient } from 'pg';
import pool from '../config/database.js';
import { logger, getCorrelationId, getContextUserId } from './logger.js';
import { AuditAction } from '../types/index.js';

/**
 * Immutable Audit Trail with Change Diffs
 * 
 * WHY: SOC2/PCI-DSS compliance requires knowing exactly
 * who changed what and when. Every mutation is logged with
 * before/after snapshots. Audit rows are NEVER updated or deleted.
 * 
 * The audit_log table has:
 *   REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC
 */

// Fields to redact from audit logs — compliance requirement
const REDACTED_FIELDS = new Set([
  'password_hash',
  'password',
  'token',
  'access_token',
  'refresh_token',
]);

/**
 * Redact sensitive fields from audit data
 */
function redactSensitiveFields(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return null;

  const redacted = { ...data };
  for (const key of Object.keys(redacted)) {
    if (REDACTED_FIELDS.has(key)) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

/**
 * Log an audit entry within an existing transaction.
 * This ensures the audit write is atomic with the business operation.
 */
export async function logAudit(
  client: PoolClient,
  params: {
    entity: string;
    entityId: string;
    action: AuditAction;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  const correlationId = getCorrelationId() || 'system';
  const userId = getContextUserId() || 'system';

  const sanitizedOld = redactSensitiveFields(params.oldValues || null);
  const sanitizedNew = redactSensitiveFields(params.newValues || null);

  try {
    await client.query(
      `INSERT INTO audit_log (entity, entity_id, action, old_values, new_values, user_id, correlation_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        params.entity,
        params.entityId,
        params.action,
        sanitizedOld ? JSON.stringify(sanitizedOld) : null,
        sanitizedNew ? JSON.stringify(sanitizedNew) : null,
        userId,
        correlationId,
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );

    logger.debug(
      {
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        correlationId,
        userId,
      },
      `Audit logged: ${params.action} on ${params.entity}`
    );
  } catch (error) {
    logger.error(
      { err: error, entity: params.entity, entityId: params.entityId },
      'Failed to write audit log entry'
    );
    throw error; // Let the transaction wrapper handle rollback
  }
}

/**
 * Query audit history for an entity (read-only)
 */
export async function getAuditHistory(
  entity: string,
  entityId: string,
  limit = 50
): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT id, entity, entity_id, action, old_values, new_values, user_id, correlation_id, timestamp
     FROM audit_log
     WHERE entity = $1 AND entity_id = $2
     ORDER BY timestamp DESC
     LIMIT $3`,
    [entity, entityId, limit]
  );
  return rows;
}
