import pool from '../config/database.js';
import { logger, getCorrelationId, getContextUserId } from './logger.js';
import { PoolClient } from 'pg';

/**
 * Atomic Transaction Wrapper with Auto-Rollback
 * 
 * WHY: Finance systems cannot tolerate half-written transactions.
 * Every mutation (POST/PUT/DELETE) is wrapped in a single DB transaction.
 * If anything fails — validation, business logic, audit logging —
 * EVERYTHING rolls back. Never leaves partial state.
 * 
 * USAGE:
 *   const result = await withTransaction(async (client) => {
 *     await client.query('INSERT INTO ...');
 *     await client.query('INSERT INTO audit_log ...');
 *     return { id: '...' };
 *   });
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  const correlationId = getCorrelationId();
  const userId = getContextUserId();

  try {
    await client.query('BEGIN');
    logger.debug({ correlationId, userId }, 'Transaction BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');
    logger.debug({ correlationId, userId }, 'Transaction COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(
      { correlationId, userId, err: error },
      'Transaction ROLLBACK — auto-rolled back due to error'
    );
    throw error;
  } finally {
    client.release();
  }
}
