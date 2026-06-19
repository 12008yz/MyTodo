import type { FastifyInstance } from "fastify";
import type { Sql } from "postgres";
import type { RedisClient } from "../redis/index.js";
import { checkDbConnection } from "../db/index.js";
import { checkRedisConnection } from "../redis/index.js";
import { healthResponseSchema } from "@mytodo/shared";

export async function registerHealthRoutes(
  app: FastifyInstance,
  deps: { dbClient: Sql; redis: RedisClient },
): Promise<void> {
  app.get(
    "/api/v1/health",
    { config: { rateLimit: false } },
    async () => {
      const [dbOk, redisOk] = await Promise.all([
        checkDbConnection(deps.dbClient),
        checkRedisConnection(deps.redis),
      ]);

      const payload = {
        status: dbOk && redisOk ? "ok" : "degraded",
        db: dbOk ? "ok" : "error",
        redis: redisOk ? "ok" : "error",
      } as const;

      return healthResponseSchema.parse(payload);
    },
  );
}
