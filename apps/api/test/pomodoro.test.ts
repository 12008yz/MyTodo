import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authResponseSchema,
  habitResponseSchema,
  pomodoroActiveResponseSchema,
  pomodoroCompleteResponseSchema,
  pomodoroSessionSchema,
  todayLightResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Pomodoro", () => {
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
        name: "Pomodoro User",
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

    return auth;
  }

  async function createRunningHabit(token: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: "running",
        baseline_value: 30,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  it("starts, completes, and adds minutes to the daily checkin", async () => {
    const auth = await createOnboardedUser("pomodoro-complete@example.com");
    const habit = await createRunningHabit(auth.access_token);

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/pomodoro/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(startResponse.statusCode).toBe(201);
    const session = pomodoroSessionSchema.parse(JSON.parse(startResponse.body));
    expect(session.completed).toBe(false);
    expect(session.work_min).toBe(25);

    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/pomodoro/complete`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(completeResponse.statusCode).toBe(200);
    const body = pomodoroCompleteResponseSchema.parse(JSON.parse(completeResponse.body));
    expect(body.minutes_added).toBe(25);
    expect(body.checkin.value).toBe(25);
    expect(body.checkin.status).toBe("pending");

    const todayResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const today = todayLightResponseSchema.parse(JSON.parse(todayResponse.body));
    expect(today.stats.pomodoros_today).toBe(1);
    expect(today.minutes_logged_today).toBe(25);
  });

  it("returns active session and rejects a second start", async () => {
    const auth = await createOnboardedUser("pomodoro-active@example.com");
    const habit = await createRunningHabit(auth.access_token);

    await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/pomodoro/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const activeResponse = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habit.id}/pomodoro/active`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const active = pomodoroActiveResponseSchema.parse(JSON.parse(activeResponse.body));
    expect(active.session).not.toBeNull();

    const duplicateStart = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/pomodoro/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(duplicateStart.statusCode).toBe(409);
  });

  it("stop cancels session without adding minutes", async () => {
    const auth = await createOnboardedUser("pomodoro-stop@example.com");
    const habit = await createRunningHabit(auth.access_token);

    await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/pomodoro/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const stopResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/pomodoro/stop`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(stopResponse.statusCode).toBe(200);
    const session = pomodoroSessionSchema.parse(JSON.parse(stopResponse.body));
    expect(session.completed).toBe(false);
    expect(session.ended_at).not.toBeNull();

    const todayResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const today = todayLightResponseSchema.parse(JSON.parse(todayResponse.body));
    expect(today.stats.pomodoros_today).toBe(0);
    expect(today.habits[0]?.checkin).toBeNull();
  });

  it("rejects pomodoro for non-minute habits", async () => {
    const auth = await createOnboardedUser("pomodoro-books@example.com");

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        template_id: "books",
        baseline_value: 5,
      },
    });

    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/v1/habits/${habit.id}/pomodoro/start`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(startResponse.statusCode).toBe(400);
  });
});
