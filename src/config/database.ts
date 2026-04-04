import pg from 'pg';
import config from './env.js';
import { logger } from '../shared/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: config.isProduction || config.database.url.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

/**
 * Check database connectivity (used by /ready probe)
 */
export async function checkDatabaseHealth(): Promise<{ connected: boolean; timestamp?: Date; error?: string }> {
  try {
    const result = await pool.query('SELECT NOW()');
    return { connected: true, timestamp: result.rows[0].now };
  } catch (err: any) {
    logger.error({ err }, 'Database health check failed');
    return { connected: false, error: err.message };
  }
}

/**
 * Run all SQL migrations in sequential order.
 * Tracks applied migrations in a _migrations table.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { readdir, readFile } = await import('fs/promises');
    const { join } = await import('path');

    const migrationsDir = join(process.cwd(), 'src', 'migrations');

    let files: string[];
    try {
      files = await readdir(migrationsDir);
    } catch {
      logger.warn('No migrations directory found');
      return;
    }

    const sqlFiles = files.filter((f: string) => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [file]
      );

      if (rows.length === 0) {
        const sql = await readFile(join(migrationsDir, file), 'utf-8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO _migrations (name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          logger.info(`✅ Migration applied: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          logger.error({ err }, `❌ Migration failed: ${file}`);
          throw err;
        }
      } else {
        logger.debug(`⏭️  Migration already applied: ${file}`);
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Close the pool gracefully (used during shutdown)
 */
export async function closeDatabasePool(): Promise<void> {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}

export default pool;
