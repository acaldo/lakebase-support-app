import pg from 'pg';
import type { AppConfig } from '../config.js';
import { LakebaseTokenProvider } from './lakebase-token.js';

const { Pool } = pg;

function observePoolErrors(pool: pg.Pool): pg.Pool {
  pool.on('error', (error) => {
    console.error('An idle database connection was discarded:', error.message);
  });
  return pool;
}

export function createDatabasePool(config: AppConfig): pg.Pool {
  const common: pg.PoolConfig = {
    host: config.PGHOST,
    port: config.PGPORT,
    database: config.PGDATABASE,
    user: config.PGUSER,
    application_name: config.PGAPPNAME,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
  };

  if (config.DB_PROVIDER === 'local') {
    return observePoolErrors(new Pool({
      ...common,
      password: config.PGPASSWORD,
      ssl: false,
    }));
  }

  const tokenProvider = new LakebaseTokenProvider(
    config.DATABRICKS_HOST,
    config.DATABRICKS_CLIENT_ID,
    config.DATABRICKS_CLIENT_SECRET,
    config.LAKEBASE_ENDPOINT_NAME,
  );

  return observePoolErrors(new Pool({
    ...common,
    password: () => tokenProvider.getDatabaseCredential(),
    ssl: { rejectUnauthorized: true },
    maxLifetimeSeconds: 50 * 60,
  }));
}
