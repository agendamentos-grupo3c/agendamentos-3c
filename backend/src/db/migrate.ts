import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { env } from '../config/env.js';

const { Client } = pg;

const migrationsDir = fileURLToPath(new URL('../../migrations/', import.meta.url));

// Migrations usam a conexão DIRETA do Neon (sem pooler); cai para a pooled se a
// direta não estiver configurada.
async function run(): Promise<void> {
  const connectionString = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations',
    );
    const applied = new Set(appliedResult.rows.map((r) => r.filename));

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await readFile(join(migrationsDir, file), 'utf8');

      // Cada migration roda em uma transação: falha aborta sem aplicar parcial.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        process.stdout.write(`✓ applied ${file}\n`);
        count += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    process.stdout.write(count === 0 ? 'nothing to apply\n' : `done (${count} migration(s))\n`);
  } finally {
    await client.end();
  }
}

run().catch((err: unknown) => {
  process.stderr.write(`migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
