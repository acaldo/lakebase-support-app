import 'dotenv/config';
import { loadConfig } from '../config.js';
import { runMigrationsWithRetry } from './migrate.js';
import { createDatabasePool } from './pool.js';

const config = loadConfig();
const pool = createDatabasePool(config);

try {
  await runMigrationsWithRetry(pool, config.DB_SCHEMA);
  console.log(`Database schema ${config.DB_SCHEMA} is up to date.`);
} finally {
  await pool.end();
}
