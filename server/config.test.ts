import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const lakebaseEnvironment = {
  DB_PROVIDER: 'lakebase',
  DB_SCHEMA: 'support_board',
  PGHOST: 'database.example.com',
  PGPORT: '5432',
  PGDATABASE: 'databricks_postgres',
  PGUSER: 'app-service-principal',
  DATABRICKS_CLIENT_ID: 'client-id',
  DATABRICKS_CLIENT_SECRET: 'client-secret',
  LAKEBASE_ENDPOINT_NAME: 'projects/project/branches/main/endpoints/primary',
} satisfies NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('normalizes a Databricks workspace hostname to an HTTPS URL', () => {
    const config = loadConfig({
      ...lakebaseEnvironment,
      DATABRICKS_HOST: 'dbc-example-workspace.cloud.databricks.com',
    });

    expect(config.DATABRICKS_HOST).toBe('https://dbc-example-workspace.cloud.databricks.com');
  });

  it('trims a complete workspace URL and removes trailing slashes', () => {
    const config = loadConfig({
      ...lakebaseEnvironment,
      DATABRICKS_HOST: '  https://another-workspace.cloud.databricks.com/  ',
    });

    expect(config.DATABRICKS_HOST).toBe('https://another-workspace.cloud.databricks.com');
  });

  it('rejects a workspace URL that does not use HTTPS', () => {
    expect(() =>
      loadConfig({
        ...lakebaseEnvironment,
        DATABRICKS_HOST: 'http://insecure-workspace.cloud.databricks.com',
      }),
    ).toThrow('Databricks workspace URL must use HTTPS');
  });
});
