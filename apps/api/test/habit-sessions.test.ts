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
});
