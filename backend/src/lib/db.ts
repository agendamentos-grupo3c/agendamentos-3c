import pg from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { DB } from '../config/constants.js';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const { Pool } = pg;

// Pool único para a aplicação, apontando para o endpoint pooled do Neon.
// Neon exige SSL; o certificado é válido, então mantemos a verificação ligada.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: DB.POOL_MAX,
  idleTimeoutMillis: DB.IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB.CONNECT_TIMEOUT_MS,
});

pool.on('error', (err) => {
  logger.error({ err }, 'unexpected database pool error');
});

// Queries sempre parametrizadas ($1, $2, ...) — nunca concatenar SQL.
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params ? [...params] : undefined);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDatabase(): Promise<void> {
  await pool.query('SELECT 1');
}

export async function closePool(): Promise<void> {
  await pool.end();
}
