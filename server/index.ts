import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig, resolvePort } from './config.js';
import { runMigrationsWithRetry } from './db/migrate.js';
import { createDatabasePool } from './db/pool.js';
import { TicketRepository } from './ticket-repository.js';

const config = loadConfig();
const pool = createDatabasePool(config);

async function shutdown(signal: string) {
  console.log(`${signal} received. Closing database connections.`);
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await runMigrationsWithRetry(pool, config.DB_SCHEMA);
  const repository = new TicketRepository(pool, config.DB_SCHEMA);
  const app = createApp({
    repository,
    provider: config.DB_PROVIDER,
    localDevUser: config.LOCAL_DEV_USER,
    serveClient: process.env.NODE_ENV === 'production' || config.DB_PROVIDER === 'lakebase',
  });
  const port = resolvePort(config);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Support Board listening on port ${port} using ${config.DB_PROVIDER}.`);
  });
} catch (error) {
  console.error('Application startup failed:', error instanceof Error ? error.message : error);
  await pool.end();
  process.exit(1);
}
