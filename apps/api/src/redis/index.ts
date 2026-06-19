import { Redis } from "ioredis";
import type { Env } from "../config/env.js";

export type RedisClient = Redis;

export function createRedis(env: Env): RedisClient {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });

  redis.on("error", () => {
    // Connection errors are reported via /health, not thrown here.
  });

  return redis;
}

export async function checkRedisConnection(redis: RedisClient): Promise<boolean> {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis(redis: RedisClient): Promise<void> {
  if (redis.status === "end" || redis.status === "close") {
    return;
  }

  try {
    if (redis.status === "ready") {
      await redis.quit();
      return;
    }
  } catch {
    // Fall through to hard disconnect.
  }

  redis.disconnect();
}
