import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { authResponseSchema, habitResponseSchema } from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { users, habitSessions } from "../src/db/schema/index.js";
import { HabitSessionService } from "../src/services/habit-sessions.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Habit sessions", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];

  beforeAll(async () => {
    await ensureMigrated(env);
    const built = await buildApp({ env });
    app = built.app;
    await app.ready();
  });

  beforeEach(async () => {
    await truncateAuthTables(app.db);
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
        name: "Habit Session User",
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
        pomodoro_work_min: 25,
      },
    });

    const [user] = await app.db.select().from(users).where(eq(users.id, auth.user.id)).limit(1);
    if (!user) {
      throw new Error("User not found after registration");
    }

    return { auth, user };
  }

  async function createBooksHabit(token: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: "books",
        baseline_value: 5,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  async function createRunningHabit(token: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: "running",
        baseline_value: 10,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  async function createPlankHabit(token: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: "plank",
        baseline_value: 35,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  it("starts and completes books session with manual value accumulation", async () => {
    const { user, auth } = await createOnboardedUser("sessions-books@example.com");
    const habit = await createBooksHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    const start = await service.start(user, habit.id, {
      plannedMin: 10,
      blockId: "2026-06-24:test:0",
    });
    expect(start.planned_min).toBe(10);
    expect(start.completed).toBe(false);

    const startedAt = new Date(Date.now() - 6_000);
    await app.db
      .update(habitSessions)
      .set({ startedAt })
      .where(and(eq(habitSessions.id, start.id), eq(habitSessions.habitId, habit.id)));

    const complete = await service.complete(user, habit.id, {
      actualValue: 8,
    });
    expect(complete.checkin.value).toBe(8);
    expect(complete.value_added).toBe(8);
  });

  it("starts plank session with planned_seconds timer", async () => {
    const { user, auth } = await createOnboardedUser("sessions-plank@example.com");
    const habit = await createPlankHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    const start = await service.start(user, habit.id, {
      plannedSeconds: 35,
      blockId: "2026-06-24:plank:35:0",
    });
    expect(start.planned_seconds).toBe(35);
    expect(start.planned_min).toBe(1);
    expect(start.remaining_seconds).toBeLessThanOrEqual(35);

    const startedAt = new Date(Date.now() - 6_000);
    await app.db
      .update(habitSessions)
      .set({ startedAt })
      .where(and(eq(habitSessions.id, start.id), eq(habitSessions.habitId, habit.id)));

    const complete = await service.complete(user, habit.id, {
      actualValue: 35,
    });
    expect(complete.checkin.value).toBe(35);
    expect(complete.value_added).toBe(35);
  });

  it("completes running session and accumulates elapsed minutes", async () => {
    const { user, auth } = await createOnboardedUser("sessions-running@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    const start = await service.start(user, habit.id, {
      plannedMin: 10,
      blockId: "2026-06-24:test:1",
    });

    const startedAt = new Date(Date.now() - 9 * 60_000 - 30_000);
    await app.db
      .update(habitSessions)
      .set({ startedAt })
      .where(and(eq(habitSessions.id, start.id), eq(habitSessions.habitId, habit.id)));

    const complete = await service.complete(user, habit.id, {});
    expect(complete.checkin.value).toBe(10);
    expect(complete.value_added).toBe(10);
  });

  it("credits one minute when a one-minute timer finishes slightly over sixty seconds", async () => {
    const { user, auth } = await createOnboardedUser("sessions-meditation@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    const start = await service.start(user, habit.id, {
      plannedMin: 1,
      blockId: "2026-06-24:meditation:0",
    });

    const startedAt = new Date(Date.now() - 65_000);
    await app.db
      .update(habitSessions)
      .set({ startedAt })
      .where(and(eq(habitSessions.id, start.id), eq(habitSessions.habitId, habit.id)));

    const complete = await service.complete(user, habit.id, {});
    expect(complete.checkin.value).toBe(1);
    expect(complete.value_added).toBe(1);
  });

  it("rejects second start while session is active", async () => {
    const { user, auth } = await createOnboardedUser("sessions-conflict@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    await service.start(user, habit.id, { plannedMin: 10 });

    await expect(service.start(user, habit.id, { plannedMin: 10 })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rejects completion when session is too short", async () => {
    const { user, auth } = await createOnboardedUser("sessions-too-short@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    await service.start(user, habit.id, { plannedMin: 10 });

    await expect(service.complete(user, habit.id, {})).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("getActive returns current session after start", async () => {
    const { user, auth } = await createOnboardedUser("sessions-active@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    const start = await service.start(user, habit.id, { plannedMin: 10 });
    const active = await service.getActive(user.id, habit.id);

    expect(active).not.toBeNull();
    expect(active?.id).toBe(start.id);
    expect(active?.remaining_seconds).toBeGreaterThan(0);
  });

  it("completes books session with full block yield when ended early", async () => {
    const { user, auth } = await createOnboardedUser("sessions-books-early@example.com");
    const habit = await createBooksHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    const start = await service.start(user, habit.id, {
      plannedMin: 10,
      blockId: "2026-06-24:test:books-early",
    });

    const startedAt = new Date(Date.now() - 8_000);
    await app.db
      .update(habitSessions)
      .set({ startedAt })
      .where(and(eq(habitSessions.id, start.id), eq(habitSessions.habitId, habit.id)));

    const complete = await service.complete(user, habit.id, {
      actualValue: 5,
      endedEarly: true,
    });
    expect(complete.checkin.value).toBe(5);
    expect(complete.value_added).toBe(5);
    expect(complete.session.actual_min).toBe(10);
  });

  it("completes running session with full planned minutes when ended early", async () => {
    const { user, auth } = await createOnboardedUser("sessions-ended-early@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    const start = await service.start(user, habit.id, {
      plannedMin: 25,
      blockId: "2026-06-24:test:early",
    });

    const startedAt = new Date(Date.now() - 6_000);
    await app.db
      .update(habitSessions)
      .set({ startedAt })
      .where(and(eq(habitSessions.id, start.id), eq(habitSessions.habitId, habit.id)));

    const complete = await service.complete(user, habit.id, {
      endedEarly: true,
    });
    expect(complete.checkin.value).toBe(25);
    expect(complete.value_added).toBe(25);
    expect(complete.session.actual_min).toBe(25);
  });

  it("pause freezes remaining and resume continues from the same point", async () => {
    const { user, auth } = await createOnboardedUser("sessions-pause@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const service = new HabitSessionService(app.db);

    const start = await service.start(user, habit.id, { plannedMin: 25 });
    const startedAt = new Date(Date.now() - 23_000);
    await app.db
      .update(habitSessions)
      .set({ startedAt })
      .where(and(eq(habitSessions.id, start.id), eq(habitSessions.habitId, habit.id)));

    const paused = await service.pause(user.id, habit.id);
    expect(paused.is_paused).toBe(true);
    expect(paused.remaining_seconds).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const stillPaused = await service.getActive(user.id, habit.id);
    expect(stillPaused?.remaining_seconds).toBe(paused.remaining_seconds);

    const resumed = await service.resume(user.id, habit.id);
    expect(resumed.is_paused).toBe(false);
    expect(resumed.remaining_seconds).toBeLessThanOrEqual((paused.remaining_seconds ?? 0) + 2);
  });
});
