import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  authResponseSchema,
  doomScrollActiveResponseSchema,
  doomScrollSessionSchema,
  doomScrollStopResponseSchema,
  habitResponseSchema,
  todayDarkResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { doomScrollSessions } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Doom scroll", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];
  let db: Awaited<ReturnType<typeof buildApp>>["app"]["db"];

  beforeAll(async () => {
    await ensureMigrated(env);
    const built = await buildApp({ env });
    app = built.app;
    db = built.app.db;
    await app.ready();
  });

  beforeEach(async () => {
    await truncateAuthTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createOnboardedUser(email: string) {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Doom User",
        age: 28,
        gender: "female",
      },
    });

    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        weight_kg: 65,
        height_cm: 170,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
      },
    });

    return auth;
  }

  async function createSocialMediaHabit(token: string, baseline = 30) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: "social_media",
        baseline_value: baseline,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  it("starts a 15-minute session and exposes it on the dark dashboard", async () => {
    const auth = await createOnboardedUser("doom-start@example.com");
    const habit = await createSocialMediaHabit(auth.access_token);

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(startResponse.statusCode).toBe(201);
    const session = doomScrollSessionSchema.parse(JSON.parse(startResponse.body));
    expect(session.duration_min).toBe(15);
    expect(session.completed).toBe(false);

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const dashboard = todayDarkResponseSchema.parse(JSON.parse(dashboardResponse.body));
    expect(dashboard.habits[0]?.doom_scroll_active?.id).toBe(session.id);
  });

  it("stop early credits actual minutes only", async () => {
    const auth = await createOnboardedUser("doom-stop-early@example.com");
    const habit = await createSocialMediaHabit(auth.access_token, 30);

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const session = doomScrollSessionSchema.parse(JSON.parse(startResponse.body));
    const startedAt = new Date(Date.now() - 5 * 60_000);

    await db
      .update(doomScrollSessions)
      .set({ startedAt })
      .where(eq(doomScrollSessions.id, session.id));

    const stopResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/stop`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(stopResponse.statusCode).toBe(200);
    const body = doomScrollStopResponseSchema.parse(JSON.parse(stopResponse.body));
    expect(body.minutes_added).toBe(5);
    expect(body.checkin.value).toBe(5);
    expect(body.checkin.status).toBe("success");
  });

  it("marks the day as fail when total minutes exceed the limit", async () => {
    const auth = await createOnboardedUser("doom-fail@example.com");
    const habit = await createSocialMediaHabit(auth.access_token, 30);

    for (const minutesAgo of [20, 6]) {
      const startResponse = await app.inject({
        method: "POST",
        url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
        headers: { authorization: `Bearer ${auth.access_token}` },
      });

      const session = doomScrollSessionSchema.parse(JSON.parse(startResponse.body));
      const startedAt = new Date(Date.now() - minutesAgo * 60_000);

      await db
        .update(doomScrollSessions)
        .set({ startedAt })
        .where(eq(doomScrollSessions.id, session.id));

      await app.inject({
        method: "POST",
        url: `/api/v1/habits/${habit.id}/doom-scroll/stop`,
        headers: { authorization: `Bearer ${auth.access_token}` },
      });
    }

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const dashboard = todayDarkResponseSchema.parse(JSON.parse(dashboardResponse.body));
    expect(dashboard.habits[0]?.checkin?.value).toBe(26);
    expect(dashboard.habits[0]?.checkin?.status).toBe("success");

    const finalStart = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const finalSession = doomScrollSessionSchema.parse(JSON.parse(finalStart.body));
    const startedAt = new Date(Date.now() - 6 * 60_000);

    await db
      .update(doomScrollSessions)
      .set({ startedAt })
      .where(eq(doomScrollSessions.id, finalSession.id));

    const stopResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/stop`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = doomScrollStopResponseSchema.parse(JSON.parse(stopResponse.body));
    expect(body.checkin.value).toBe(32);
    expect(body.checkin.status).toBe("fail");
  });

  it("auto-finalizes expired session and allows a new start", async () => {
    const auth = await createOnboardedUser("doom-expired@example.com");
    const habit = await createSocialMediaHabit(auth.access_token, 30);

    const firstStart = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const firstSession = doomScrollSessionSchema.parse(JSON.parse(firstStart.body));
    const startedAt = new Date(Date.now() - 20 * 60_000);
    const endsAt = new Date(Date.now() - 5 * 60_000);

    await db
      .update(doomScrollSessions)
      .set({ startedAt, endsAt })
      .where(eq(doomScrollSessions.id, firstSession.id));

    const secondStart = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(secondStart.statusCode).toBe(201);

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const dashboard = todayDarkResponseSchema.parse(JSON.parse(dashboardResponse.body));
    expect(dashboard.habits[0]?.checkin?.value).toBe(15);
    expect(dashboard.habits[0]?.doom_scroll_active).not.toBeNull();
  });

  it("returns null active session after stop", async () => {
    const auth = await createOnboardedUser("doom-active@example.com");
    const habit = await createSocialMediaHabit(auth.access_token);

    await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/stop`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const activeResponse = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habit.id}/doom-scroll/active`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const active = doomScrollActiveResponseSchema.parse(JSON.parse(activeResponse.body));
    expect(active.session).toBeNull();
  });

  it("rejects doom scroll for non-social habits", async () => {
    const auth = await createOnboardedUser("doom-smoking@example.com");

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        template_id: "smoking",
        baseline_value: 20,
      },
    });

    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/doom-scroll/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(startResponse.statusCode).toBe(400);
  });
});
