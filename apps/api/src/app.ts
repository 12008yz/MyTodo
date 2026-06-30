import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import type { Env } from "./config/env.js";
import { createDb } from "./db/index.js";
import { createRedis, closeRedis } from "./redis/index.js";
import { errorHandler } from "./lib/error-handler.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerHabitRoutes } from "./routes/habits.js";
import { registerCheckinRoutes } from "./routes/checkins.js";
import { registerTodayRoutes } from "./routes/today.js";
import { registerPomodoroRoutes } from "./routes/pomodoro.js";
import { registerHabitSessionRoutes } from "./routes/habit-sessions.js";
import { registerReadingRoutes } from "./routes/reading.js";
import { registerNutritionRoutes } from "./routes/nutrition.js";
import { registerDoomScrollRoutes } from "./routes/doom-scroll.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerEnglishRoutes } from "./routes/english.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerPledgeRoutes } from "./routes/pledges.js";
import { registerPushRoutes } from "./routes/push.js";
import { registerCoachRoutes } from "./routes/coach.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { createAuthServices } from "./services/auth.js";
import { HabitService } from "./services/habits.js";
import { CheckinService } from "./services/checkins.js";
import { TodayService } from "./services/today.js";
import { PomodoroService } from "./services/pomodoro.js";
import { HabitSessionService } from "./services/habit-sessions.js";
import { ReadingProgressService } from "./services/reading-progress.js";
import { NutritionLogService } from "./services/nutrition-log.js";
import { DoomScrollService } from "./services/doom-scroll.js";
import { StatsService } from "./services/stats.js";
import { EnglishService } from "./services/english.js";
import { BillingService } from "./services/billing.js";
import { PledgeService } from "./services/pledges.js";
import { PushService, seedPushTemplates } from "./services/push.js";
import { seedEnglishLessons } from "./services/seed.js";
import { AdminService } from "./services/admin.js";
import { CoachService, resolveCoachGigaChatClient } from "./services/coach.js";
import { createYukassaClient } from "./lib/yukassa/client.js";
import { resolveWebPushClient, type WebPushClient } from "./lib/web-push/index.js";
import { createPushQueue } from "./worker/push-queue.js";
import { createRequireAccess } from "./plugins/require-access.js";
import { createRequireAdmin } from "./plugins/require-admin.js";

export type AppDependencies = {
  env: Env;
  yukassaClient?: import("./lib/yukassa/types.js").YukassaClient;
  webPushClient?: WebPushClient;
};

export type BuiltApp = {
  app: FastifyInstance;
  dbClient: ReturnType<typeof createDb>["client"];
  redis: ReturnType<typeof createRedis>;
};

export async function buildApp({ env, yukassaClient, webPushClient }: AppDependencies): Promise<BuiltApp> {
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
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  app.setErrorHandler(errorHandler);

  const habitService = new HabitService(db);
  const yukassa = createYukassaClient(env, yukassaClient);
  const pledgeService = new PledgeService(db, yukassa);
  const webPush = resolveWebPushClient(env, webPushClient);
  const pushService = new PushService(db, webPush, app.log);
  await seedPushTemplates(db);
  if (env.NODE_ENV === "development") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedEnglishLessons(db);
  }
  const { authService, userService } = createAuthServices(app, db, pledgeService);
  const billingService = new BillingService(db, yukassa, pledgeService);
  const readingProgressService = new ReadingProgressService(db);
  const nutritionLogService = new NutritionLogService(db);
  const checkinService = new CheckinService(db, pledgeService, pushService, readingProgressService);
  const pushQueue = env.NODE_ENV === "test" ? undefined : createPushQueue(redis);
  const pomodoroService = new PomodoroService(db, pledgeService);
  const habitSessionService = new HabitSessionService(db, pledgeService, readingProgressService);
  const doomScrollService = new DoomScrollService(db, checkinService, pushService, pushQueue);
  const todayService = new TodayService(
    db,
    pomodoroService,
    doomScrollService,
    habitSessionService,
    readingProgressService,
    nutritionLogService,
    checkinService,
  );
  const statsService = new StatsService(db);
  const englishService = new EnglishService(db, checkinService);
  const requireAccess = createRequireAccess(db, billingService);
  const requireAdmin = createRequireAdmin(db);
  const adminService = new AdminService(db, billingService, pledgeService);
  const coachService = new CoachService(
    db,
    env.NODE_ENV === "test" ? null : redis,
    resolveCoachGigaChatClient(env.GIGACHAT_CREDENTIALS),
  );

  await registerHealthRoutes(app, { dbClient, redis });
  await registerAuthRoutes(app, authService);
  await registerMeRoutes(app, userService, habitService);
  await registerHabitRoutes(app, userService, habitService);
  await registerCheckinRoutes(app, userService, checkinService, requireAccess);
  await registerTodayRoutes(app, userService, todayService, requireAccess);
  await registerPomodoroRoutes(app, userService, pomodoroService, requireAccess);
  await registerHabitSessionRoutes(app, userService, habitSessionService, requireAccess);
  await registerReadingRoutes(app, userService, readingProgressService, requireAccess);
  await registerNutritionRoutes(app, userService, nutritionLogService, requireAccess);
  await registerDoomScrollRoutes(app, userService, doomScrollService, requireAccess);
  await registerStatsRoutes(app, userService, statsService, requireAccess);
  await registerEnglishRoutes(app, userService, englishService, requireAccess);
  await registerBillingRoutes(app, billingService);
  await registerPledgeRoutes(app, pledgeService, requireAccess);
  await registerPushRoutes(app, pushService, requireAccess);
  await registerCoachRoutes(app, userService, coachService, requireAccess);
  await registerAdminRoutes(app, adminService, pushService, requireAdmin);

  app.addHook("onClose", async () => {
    if (pushQueue) {
      await pushQueue.close();
    }
    await dbClient.end({ timeout: 5 });
    await closeRedis(redis);
  });

  app.decorate("db", db);

  return { app, dbClient, redis };
}

declare module "fastify" {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>["db"];
  }
}
