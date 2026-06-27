import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { computeNextGoal } from "@mytodo/domain";
import {
  authResponseSchema,
  habitResponseSchema,
  todayDarkResponseSchema,
  todayLightResponseSchema,
  habitTimerResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { CheckinService } from "../src/services/checkins.js";
import { DayCloseService } from "../src/services/day-close.js";
import { DoomScrollService } from "../src/services/doom-scroll.js";
import { habits, users } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

function shiftDate(date: string, deltaDays: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return parsed.toISOString().slice(0, 10);
}

describe("Today dashboards", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];
  let db: Awaited<ReturnType<typeof buildApp>>["app"]["db"];
  let dayCloseService: DayCloseService;

  beforeAll(async () => {
    await ensureMigrated(env);
    const built = await buildApp({ env });
    app = built.app;
    db = built.app.db;
    const checkinService = new CheckinService(db);
    const doomScrollService = new DoomScrollService(db, checkinService);
    dayCloseService = new DayCloseService(db, doomScrollService);
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
        name: "Dash User",
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
        free_time_min: 45,
        wake_time: "07:00",
        sleep_time: "23:00",
      },
    });

    return auth;
  }

  async function createLightHabit(token: string, templateId: "running" | "books" = "running") {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: templateId,
        baseline_value: templateId === "books" ? 10 : 30,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  async function createDarkHabit(token: string, templateId: "smoking" | "nail_biting" = "smoking") {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: templateId,
        baseline_value: templateId === "smoking" ? 20 : 0,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  it("returns light dashboard with budget, stats, and preview_next_goal from domain", async () => {
    const auth = await createOnboardedUser("today-light@example.com");
    const habit = await createLightHabit(auth.access_token);

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        value: 50,
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = todayLightResponseSchema.parse(JSON.parse(response.body));

    expect(body.greeting_name).toBe("Dash User");
    expect(body.daily_budget_min).toBe(45);
    expect(body.minutes_logged_today).toBe(50);
    expect(body.stats.completed_today).toBe(1);
    expect(body.habits).toHaveLength(1);
    expect(body.habits[0]?.checkin?.status).toBe("success");
    expect(body.habits[0]?.preview_next_goal).toBe(
      computeNextGoal(
        {
          type: "target",
          side: "light",
          currentGoal: habit.current_goal,
          growthStep: habit.growth_step,
          progressionDirection: "increase",
          progressionIntervalDays: habit.progression_interval_days,
          successDaysAtGoal: habit.success_days_at_goal,
        },
        "success",
      ),
    );
  });

  it("includes daily_plan with blocks for light dashboard", async () => {
    const auth = await createOnboardedUser("today-light-plan@example.com");
    const firstHabit = await createLightHabit(auth.access_token, "running");
    const secondHabit = await createLightHabit(auth.access_token, "books");

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = todayLightResponseSchema.parse(JSON.parse(response.body));
    const plannedHabitIds = new Set(body.daily_plan.blocks.map((block) => block.habit_id));

    expect(body.habits).toHaveLength(2);
    expect(body.daily_plan.minutes_planned).toBeGreaterThan(0);
    expect(body.daily_plan.blocks.length).toBeGreaterThan(0);
    expect(plannedHabitIds.has(firstHabit.id)).toBe(true);
    expect(plannedHabitIds.has(secondHabit.id)).toBe(true);
  });

  it("returns dark dashboard with timer for abstinence habits", async () => {
    const auth = await createOnboardedUser("today-dark@example.com");
    const habit = await createDarkHabit(auth.access_token, "nail_biting");

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = todayDarkResponseSchema.parse(JSON.parse(response.body));

    expect(body.habits).toHaveLength(1);
    expect(body.greeting_name).toBe("Dash User");
    expect(body.habits[0]?.timer?.started_at).toBe(habit.last_relapse_at);
    expect(body.habits[0]?.doom_scroll_active).toBeNull();
  });

  it("returns habit timer endpoint for abstinence habits", async () => {
    const auth = await createOnboardedUser("timer@example.com");
    const habit = await createDarkHabit(auth.access_token, "nail_biting");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habit.id}/timer`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = habitTimerResponseSchema.parse(JSON.parse(response.body));
    expect(body.habit_id).toBe(habit.id);
    expect(body.timer.elapsed.total_seconds).toBeGreaterThanOrEqual(0);
  });

  it("rejects timer for limit habits", async () => {
    const auth = await createOnboardedUser("timer-limit@example.com");
    const habit = await createDarkHabit(auth.access_token, "smoking");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habit.id}/timer`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it("does not expose timer for limit habits on dark dashboard", async () => {
    const auth = await createOnboardedUser("today-dark-limit@example.com");
    await createDarkHabit(auth.access_token, "smoking");

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = todayDarkResponseSchema.parse(JSON.parse(response.body));
    expect(body.habits[0]?.type).toBe("limit");
    expect(body.habits[0]?.timer).toBeNull();
  });

  it("shows unchanged preview_next_goal after a fail checkin", async () => {
    const auth = await createOnboardedUser("today-fail-preview@example.com");
    const habit = await createDarkHabit(auth.access_token, "smoking");

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        value: 25,
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = todayDarkResponseSchema.parse(JSON.parse(response.body));
    expect(body.habits[0]?.checkin?.status).toBe("fail");
    expect(body.habits[0]?.preview_next_goal).toBe(habit.current_goal);
  });

  it("returns abstinence streak on dark dashboard without daily checkins", async () => {
    const auth = await createOnboardedUser("today-abstinence-streak@example.com");
    const habit = await createDarkHabit(auth.access_token, "nail_biting");

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { timezone: "UTC" },
    });

    const todayResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });
    const today = todayDarkResponseSchema.parse(JSON.parse(todayResponse.body)).date;

    await db
      .update(habits)
      .set({ createdAt: new Date(`${shiftDate(today, -10)}T12:00:00.000Z`) })
      .where(eq(habits.id, habit.id));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = todayDarkResponseSchema.parse(JSON.parse(response.body));
    expect(body.habits[0]?.streak_days).toBeGreaterThan(0);
  });

  it("counts relapses this week and streak days in stats", async () => {
    const auth = await createOnboardedUser("today-stats@example.com");
    const habit = await createLightHabit(auth.access_token);

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { timezone: "UTC" },
    });

    const todayResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });
    const today = todayLightResponseSchema.parse(JSON.parse(todayResponse.body)).date;

    await db
      .update(habits)
      .set({ createdAt: new Date(`${shiftDate(today, -10)}T12:00:00.000Z`) })
      .where(eq(habits.id, habit.id));

    for (const offset of [-3, -2, -1]) {
      await app.inject({
        method: "POST",
        url: "/api/v1/checkins",
        headers: { authorization: `Bearer ${auth.access_token}` },
        payload: {
          habit_id: habit.id,
          date: shiftDate(today, offset),
          value: 50,
        },
      });
    }

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        date: today,
        value: 10,
      },
    });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, "today-stats@example.com"));
    await dayCloseService.closeDayForUser(user!, today);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = todayLightResponseSchema.parse(JSON.parse(response.body));
    expect(body.stats.relapses_this_week).toBe(1);
    expect(body.stats.streak_days).toBe(0);
    expect(body.habits[0]?.streak_days).toBe(0);
  });
});
