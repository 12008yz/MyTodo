import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { findDueScheduleEvents } from "@mytodo/domain";
import {
  authResponseSchema,
  habitResponseSchema,
  pushTestResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { MockWebPushClient } from "../src/lib/web-push/mock-client.js";
import { CheckinService } from "../src/services/checkins.js";
import { DoomScrollService } from "../src/services/doom-scroll.js";
import { PushService } from "../src/services/push.js";
import { habits, pushDeliveryLog, users } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Push notifications", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];
  let db: Awaited<ReturnType<typeof buildApp>>["app"]["db"];
  let webPush: MockWebPushClient;
  let pushService: PushService;

  beforeAll(async () => {
    await ensureMigrated(env);
    webPush = new MockWebPushClient();
    const built = await buildApp({ env, webPushClient: webPush });
    app = built.app;
    db = built.app.db;
    pushService = new PushService(db, webPush);
    await app.ready();
  });

  beforeEach(async () => {
    webPush.clear();
    await truncateAuthTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAndOnboard(email = "push@example.com") {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Push User",
        age: 30,
        gender: "male",
      },
    });
    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));
    const headers = { authorization: `Bearer ${auth.access_token}` };

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers,
      payload: {
        weight_kg: 80,
        height_cm: 180,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
        harshness_level: 2,
        timezone: "Europe/Moscow",
      },
    });

    return { auth, headers };
  }

  async function subscribe(headers: Record<string, string>) {
    await app.inject({
      method: "POST",
      url: "/api/v1/push/subscribe",
      headers,
      payload: {
        endpoint: "https://push.example/subscription-1",
        keys: {
          p256dh: "test-p256dh-key",
          auth: "test-auth-key",
        },
      },
    });
  }

  it("subscribes and sends test push", async () => {
    const { headers } = await registerAndOnboard();
    await subscribe(headers);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/push/test",
      headers,
    });

    const body = pushTestResponseSchema.parse(JSON.parse(response.body));
    expect(body.sent).toBe(true);
    expect(webPush.sent).toHaveLength(1);
  });

  it("sends relapse push on abstinence fail checkin", async () => {
    const { headers } = await registerAndOnboard("relapse@example.com");
    await subscribe(headers);

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "nail_biting", baseline_value: 0 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: habit.id, status: "fail" },
    });

    expect(webPush.sent).toHaveLength(1);
    const payload = JSON.parse(webPush.sent[0]!.payload) as { event_type: string };
    expect(payload.event_type).toBe("relapse");
  });

  it("does not send cheer after relapse today", async () => {
    const { headers } = await registerAndOnboard("no-cheer@example.com");
    await subscribe(headers);

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "smoking", baseline_value: 0 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await db
      .update(habits)
      .set({ phase: "abstinence", currentGoal: "0" })
      .where(eq(habits.id, habit.id));

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: habit.id, status: "fail" },
    });

    webPush.clear();

    const [user] = await db.select().from(users).where(eq(users.email, "no-cheer@example.com"));
    const now = new Date("2026-06-18T08:00:00.000Z");
    await pushService.runScheduledPushes(now);

    expect(webPush.sent).toHaveLength(0);
  });

  it("blocks all push during silence mode", async () => {
    const { headers } = await registerAndOnboard("silence-push@example.com");
    await subscribe(headers);

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers,
      payload: { enable_silence_mode: true },
    });

    const testResponse = await app.inject({
      method: "POST",
      url: "/api/v1/push/test",
      headers,
    });
    const body = pushTestResponseSchema.parse(JSON.parse(testResponse.body));
    expect(body.sent).toBe(false);
    expect(webPush.sent).toHaveLength(0);
  });

  it("deduplicates scheduled morning push on repeated worker runs", async () => {
    const { headers } = await registerAndOnboard("dedup@example.com");
    await subscribe(headers);

    const [user] = await db.select().from(users).where(eq(users.email, "dedup@example.com"));
    const now = new Date("2026-06-18T04:00:00.000Z");
    expect(findDueScheduleEvents(now, user!.timezone, "07:00", "23:00")).toEqual(["morning"]);

    await pushService.runScheduledPushes(now);
    await pushService.runScheduledPushes(now);

    expect(webPush.sent).toHaveLength(1);

    const logs = await db
      .select()
      .from(pushDeliveryLog)
      .where(and(eq(pushDeliveryLog.userId, user!.id), eq(pushDeliveryLog.eventType, "morning")));
    expect(logs).toHaveLength(1);
  });

  it("sends doom scroll start push immediately", async () => {
    const { headers } = await registerAndOnboard("doom@example.com");
    await subscribe(headers);

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "social_media", baseline_value: 30 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers,
    });

    expect(webPush.sent).toHaveLength(1);
    const payload = JSON.parse(webPush.sent[0]!.payload) as { event_type: string };
    expect(payload.event_type).toBe("doom_scroll_start");
  });

  it("sends doom scroll end push when session expires naturally", async () => {
    const { headers } = await registerAndOnboard("doom-end@example.com");
    await subscribe(headers);

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "social_media", baseline_value: 30 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers,
    });
    expect(startResponse.statusCode).toBe(201);

    const doomScrollService = new DoomScrollService(db, new CheckinService(db), pushService);
    await doomScrollService.finalizeExpiredSessionsUpTo(new Date(Date.now() + 16 * 60_000));

    expect(
      webPush.sent.some((entry) => JSON.parse(entry.payload).event_type === "doom_scroll_end"),
    ).toBe(true);
  });

  it("does not reserve scheduled push slot without subscription", async () => {
    await registerAndOnboard("no-sub@example.com");

    const [user] = await db.select().from(users).where(eq(users.email, "no-sub@example.com"));
    const now = new Date("2026-06-18T04:00:00.000Z");

    await pushService.runScheduledPushes(now);
    await pushService.runScheduledPushes(now);

    const logs = await db
      .select()
      .from(pushDeliveryLog)
      .where(eq(pushDeliveryLog.userId, user!.id));
    expect(logs).toHaveLength(0);
  });
});
