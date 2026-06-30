import "../config/load-dotenv.js";
import { loadEnv } from "../config/env.js";
import { initSentry } from "../lib/sentry.js";
import { createDb } from "../db/index.js";
import { createRedis, closeRedis } from "../redis/index.js";
import { CheckinService } from "../services/checkins.js";
import { DoomScrollService } from "../services/doom-scroll.js";
import { DayCloseService } from "../services/day-close.js";
import { BillingService } from "../services/billing.js";
import { PledgeService } from "../services/pledges.js";
import { PomodoroService } from "../services/pomodoro.js";
import { PushService, seedPushTemplates } from "../services/push.js";
import { createYukassaClient } from "../lib/yukassa/client.js";
import { resolveWebPushClient } from "../lib/web-push/index.js";
import { createPushQueue } from "./push-queue.js";
import { startWorker } from "./scheduler.js";
import { startPushWorker } from "./push-queue.js";

async function main(): Promise<void> {
  const env = loadEnv();
  initSentry(env.SENTRY_DSN);

  const { db, client: dbClient } = createDb(env);
  const redis = createRedis(env);
  const yukassa = createYukassaClient(env);
  const pledgeService = new PledgeService(db, yukassa);

  const logger = {
    info: (obj: Record<string, unknown>, message?: string) => {
      console.log(JSON.stringify({ level: "info", msg: message, ...obj }));
    },
    error: (obj: Record<string, unknown>, message?: string) => {
      console.error(JSON.stringify({ level: "error", msg: message, ...obj }));
    },
  };

  const webPush = resolveWebPushClient(env);
  const pushService = new PushService(db, webPush, logger);
  await seedPushTemplates(db);
  const pushQueue = createPushQueue(redis);
  const checkinService = new CheckinService(db, pledgeService, pushService);
  const pomodoroService = new PomodoroService(db, pledgeService, pushQueue);
  const doomScrollService = new DoomScrollService(db, checkinService, pushService, pushQueue);
  const dayCloseService = new DayCloseService(db, doomScrollService, pledgeService, pushService);
  const billingService = new BillingService(db, yukassa, pledgeService);

  const { worker } = await startWorker(
    redis,
    db,
    checkinService,
    dayCloseService,
    billingService,
    pledgeService,
    pushService,
    logger,
  );
  const { worker: pushWorker } = await startPushWorker(
    redis,
    pushService,
    doomScrollService,
    pomodoroService,
    logger,
  );

  const shutdown = async () => {
    await worker.close();
    await pushWorker.close();
    await closeRedis(redis);
    await dbClient.end({ timeout: 5 });
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
