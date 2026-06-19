import "dotenv/config";
import { loadEnv } from "../config/env.js";
import { initSentry } from "../lib/sentry.js";
import { createDb } from "../db/index.js";
import { createRedis, closeRedis } from "../redis/index.js";
import { CheckinService } from "../services/checkins.js";
import { DoomScrollService } from "../services/doom-scroll.js";
import { DayCloseService } from "../services/day-close.js";
import { BillingService } from "../services/billing.js";
import { createYukassaClient } from "../lib/yukassa/client.js";
import { startWorker } from "./scheduler.js";

async function main(): Promise<void> {
  const env = loadEnv();
  initSentry(env.SENTRY_DSN);

  const { db, client: dbClient } = createDb(env);
  const redis = createRedis(env);
  const checkinService = new CheckinService(db);
  const doomScrollService = new DoomScrollService(db, checkinService);
  const dayCloseService = new DayCloseService(db, doomScrollService);
  const billingService = new BillingService(db, createYukassaClient(env));

  const logger = {
    info: (obj: Record<string, unknown>, message?: string) => {
      console.log(JSON.stringify({ level: "info", msg: message, ...obj }));
    },
    error: (obj: Record<string, unknown>, message?: string) => {
      console.error(JSON.stringify({ level: "error", msg: message, ...obj }));
    },
  };

  const { worker } = await startWorker(redis, dayCloseService, billingService, logger);

  const shutdown = async () => {
    await worker.close();
    await closeRedis(redis);
    await dbClient.end({ timeout: 5 });
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
