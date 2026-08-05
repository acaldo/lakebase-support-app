import { z } from 'zod';

const baseEnvironmentSchema = z.object({
  DB_PROVIDER: z.enum(['local', 'lakebase']).default('local'),
  DB_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default('support_board'),
  PGHOST: z.string().min(1),
  PGPORT: z.coerce.number().int().positive().default(5432),
  PGDATABASE: z.string().min(1),
  PGUSER: z.string().min(1),
  PGAPPNAME: z.string().default('lakebase-support-board'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  PORT: z.coerce.number().int().positive().optional(),
  DATABRICKS_APP_PORT: z.coerce.number().int().positive().optional(),
  LOCAL_DEV_USER: z.string().email().default('developer@example.com'),
});

const localEnvironmentSchema = baseEnvironmentSchema.extend({
  DB_PROVIDER: z.literal('local'),
  PGPASSWORD: z.string().min(1),
});

const databricksHostSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const host = value.trim().replace(/\/+$/, '');
    return /^https?:\/\//i.test(host) ? host : `https://${host}`;
  },
  z.string().url().refine((value) => new URL(value).protocol === 'https:', {
    message: 'Databricks workspace URL must use HTTPS',
  }),
);

const lakebaseEnvironmentSchema = baseEnvironmentSchema.extend({
  DB_PROVIDER: z.literal('lakebase'),
  DATABRICKS_HOST: databricksHostSchema,
  DATABRICKS_CLIENT_ID: z.string().min(1),
  DATABRICKS_CLIENT_SECRET: z.string().min(1),
  LAKEBASE_ENDPOINT_NAME: z.string().min(1),
});

export type AppConfig = z.infer<typeof localEnvironmentSchema> | z.infer<typeof lakebaseEnvironmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const provider = environment.DB_PROVIDER ?? 'local';
  const schema = provider === 'lakebase' ? lakebaseEnvironmentSchema : localEnvironmentSchema;
  const result = schema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid application configuration: ${details}`);
  }

  return result.data;
}

export function resolvePort(config: AppConfig): number {
  return config.DATABRICKS_APP_PORT ?? config.PORT ?? config.API_PORT;
}
