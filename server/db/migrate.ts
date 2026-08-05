import { promises as fs } from 'node:fs';
import path from 'node:path';
import type pg from 'pg';

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

function quoteIdentifier(identifier: string): string {
  if (!SCHEMA_PATTERN.test(identifier)) {
    throw new Error(`Unsafe database schema name: ${identifier}`);
  }
  return `"${identifier}"`;
}

export async function runMigrations(pool: pg.Pool, schema: string): Promise<void> {
  const quotedSchema = quoteIdentifier(schema);
  const migrationsDirectory = path.resolve(process.cwd(), 'server/db/migrations');
  const migrationFiles = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [`${schema}:migrations`]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotedSchema}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${quotedSchema}.schema_migrations (
        migration_name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migrationName of migrationFiles) {
      const alreadyApplied = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM ${quotedSchema}.schema_migrations WHERE migration_name = $1
        ) AS exists`,
        [migrationName],
      );
      if (alreadyApplied.rows[0]?.exists) continue;

      const rawSql = await fs.readFile(path.join(migrationsDirectory, migrationName), 'utf8');
      const migrationSql = rawSql.replaceAll('{{schema}}', quotedSchema);

      await client.query('BEGIN');
      try {
        await client.query(migrationSql);
        await client.query(
          `INSERT INTO ${quotedSchema}.schema_migrations (migration_name) VALUES ($1)`,
          [migrationName],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`${schema}:migrations`]).catch(() => undefined);
    client.release();
  }
}

export async function runMigrationsWithRetry(
  pool: pg.Pool,
  schema: string,
  attempts = 5,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runMigrations(pool, schema);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 8000)));
    }
  }
  throw lastError;
}
