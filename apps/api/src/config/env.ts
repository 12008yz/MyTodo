import { z } from "zod";

const DEFAULT_DATABASE_URL = "postgresql://mytodo:mytodo@localhost:5433/mytodo";
const DEFAULT_REDIS_URL = "redis://localhost:6380";
const DEFAULT_JWT_ACCESS_SECRET = "dev-access-secret-change-me";
const DEFAULT_JWT_REFRESH_SECRET = "dev-refresh-secret-change-me";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  YUKASSA_SHOP_ID: z.string().optional(),
  YUKASSA_SECRET_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  GIGACHAT_CREDENTIALS: z.string().optional(),
});

export type Env = z.infer<typeof baseEnvSchema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = input.NODE_ENV ?? "development";
  const useDevDefaults = nodeEnv === "development" || nodeEnv === "test";

  return baseEnvSchema.parse({
    ...input,
    DATABASE_URL: input.DATABASE_URL ?? (useDevDefaults ? DEFAULT_DATABASE_URL : undefined),
    REDIS_URL: input.REDIS_URL ?? (useDevDefaults ? DEFAULT_REDIS_URL : undefined),
    JWT_ACCESS_SECRET:
      input.JWT_ACCESS_SECRET ?? (useDevDefaults ? DEFAULT_JWT_ACCESS_SECRET : undefined),
    JWT_REFRESH_SECRET:
      input.JWT_REFRESH_SECRET ?? (useDevDefaults ? DEFAULT_JWT_REFRESH_SECRET : undefined),
  });
}
