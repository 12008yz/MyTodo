import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { Env } from "./config/env.js";
import { createDb } from "./db/index.js";
import { createRedis, closeRedis } from "./redis/index.js";
import { errorHandler } from "./lib/error-handler.js";
import { registerHealthRoutes } from "./routes/health.js";

export type AppDependencies = {
  env: Env;
};

export type BuiltApp = {
  app: FastifyInstance;
  dbClient: ReturnType<typeof createDb>["client"];
  redis: ReturnType<typeof createRedis>;
};

export async function buildApp({ env }: AppDependencies): Promise<BuiltApp> {
  const { db, client: dbClient } = createDb(env);
  const redis = createRedis(env);

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info",
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  app.setErrorHandler(errorHandler);

  await registerHealthRoutes(app, { dbClient, redis });

  app.addHook("onClose", async () => {
    await dbClient.end({ timeout: 5 });
    await closeRedis(redis);
  });

  // Keep db reference for future routes
  app.decorate("db", db);

  return { app, dbClient, redis };
}

declare module "fastify" {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>["db"];
  }
}
