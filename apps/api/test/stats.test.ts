import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { addDays, getUserLocalDate, getWeekStartMonday } from "@mytodo/domain";
import {
  authResponseSchema,
  habitResponseSchema,
  statsCalendarResponseSchema,
  statsMonthResponseSchema,
  statsProgressResponseSchema,
  statsSummaryResponseSchema,
  statsWeekResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { dailyStats, goalSnapshots, habits } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

const TIMEZONE = "Europe/Moscow";

function todayLocal(): string {
  return getUserLocalDate(new Date(), TIMEZONE);
}

function currentMonth(): string {
  return todayLocal().slice(0, 7);
}

describe("Stats", () => {
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
        name: "Stats User",
        age: 28,
        gender: "female",
      },
    });

    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      payload: {
        weight_kg: 65,
        height_cm: 170,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
        timezone: TIMEZONE,
      },
      headers: { authorization: `Bearer ${auth.access_token}` },
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

  async function backdateHabit(habitId: string, createdAt: string) {
    await db
      .update(habits)
      .set({ createdAt: new Date(`${createdAt}T12:00:00.000Z`) })
      .where(eq(habits.id, habitId));
  }

  async function seedDailyStats(
    habitId: string,
    rows: Array<{
      date: string;
      status: "success" | "fail" | "skipped";
      value?: number;
      minutes_total?: number;
    }>,
  ) {
    for (const row of rows) {
      await db.insert(dailyStats).values({
        habitId,
        date: row.date,
        status: row.status,
        value: row.value?.toString() ?? null,
        minutesTotal: row.minutes_total ?? 0,
      });
    }
  }

  async function seedGoalSnapshots(
    habitId: string,
    rows: Array<{ date: string; goal_value: number }>,
  ) {
    for (const row of rows) {
      await db.insert(goalSnapshots).values({
        habitId,
        date: row.date,
        goalValue: row.goal_value.toString(),
      });
    }
  }

  it("returns week colors for today and future days without closed stats", async () => {
    const auth = await createOnboardedUser("stats-empty@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const today = todayLocal();
    const weekStart = getWeekStartMonday(today);
    await backdateHabit(habit.id, weekStart);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stats/week?side=light&week_start=${weekStart}`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = statsWeekResponseSchema.parse(JSON.parse(response.body));
    expect(body.days).toHaveLength(7);
    expect(body.days.every((day) => day.total === 1)).toBe(true);

    for (const day of body.days) {
      if (day.date < today) {
        expect(day.color).toBe("fail");
      } else {
        expect(day.color).toBe("pending");
      }
    }
  });

  it("reads week colors from daily_stats fixtures", async () => {
    const auth = await createOnboardedUser("stats-week@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const today = todayLocal();
    const currentWeekStart = getWeekStartMonday(today);
    const wednesday = addDays(currentWeekStart, 2);
    // Mon–Wed fixtures must be fully closed: use current week only when today is Thu+.
    const weekStart = wednesday < today ? currentWeekStart : addDays(currentWeekStart, -7);
    await backdateHabit(habit.id, weekStart);

    const seededDates = [
      weekStart,
      addDays(weekStart, 1),
      addDays(weekStart, 2),
    ] as const;

    await seedDailyStats(habit.id, [
      { date: seededDates[0], status: "success", value: 30 },
      { date: seededDates[1], status: "skipped" },
      { date: seededDates[2], status: "fail", value: 10 },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stats/week?side=light&week_start=${weekStart}`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = statsWeekResponseSchema.parse(JSON.parse(response.body));
    expect(body.days[0]?.color).toBe("success");
    expect(body.days[0]?.completed).toBe(1);
    expect(body.days[1]?.color).toBe("skipped");
    expect(body.days[2]?.color).toBe("fail");

    const todayIndex = body.days.findIndex((day) => day.date === today);
    const seededSet = new Set(seededDates);
    if (todayIndex >= 0 && !seededSet.has(today)) {
      expect(body.days[todayIndex]?.color).toBe("pending");
    }
  });

  it("returns month summary only for fully closed days in daily_stats", async () => {
    const auth = await createOnboardedUser("stats-month@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const month = currentMonth();
    const monthStart = `${month}-01`;
    await backdateHabit(habit.id, monthStart);

    await seedDailyStats(habit.id, [
      { date: addDays(monthStart, 0), status: "success", value: 30 },
      { date: addDays(monthStart, 1), status: "success", value: 35 },
      { date: addDays(monthStart, 2), status: "fail", value: 10 },
      { date: addDays(monthStart, 3), status: "skipped" },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stats/month?month=${month}&side=light`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = statsMonthResponseSchema.parse(JSON.parse(response.body));
    expect(body.closed_days).toBe(4);
    expect(body.success_days).toBe(2);
    expect(body.relapses).toBe(1);
    expect(body.skipped_days).toBe(1);
    expect(body.success_rate).toBe(50);
  });

  it("ignores partially closed multi-habit days in month summary", async () => {
    const auth = await createOnboardedUser("stats-month-partial@example.com");
    const first = await createRunningHabit(auth.access_token);
    const second = await createRunningHabit(auth.access_token);
    const month = currentMonth();
    const monthStart = `${month}-01`;
    await backdateHabit(first.id, monthStart);
    await backdateHabit(second.id, monthStart);

    await seedDailyStats(first.id, [{ date: addDays(monthStart, 0), status: "success", value: 30 }]);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stats/month?month=${month}&side=light`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = statsMonthResponseSchema.parse(JSON.parse(response.body));
    expect(body.closed_days).toBe(0);
    expect(body.success_days).toBe(0);
    expect(body.success_rate).toBe(0);
  });

  it("returns calendar details for mixed days", async () => {
    const auth = await createOnboardedUser("stats-calendar@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const month = currentMonth();
    const monthStart = `${month}-01`;
    await backdateHabit(habit.id, monthStart);

    const successDate = addDays(monthStart, 9);
    const skippedDate = addDays(monthStart, 10);

    await seedDailyStats(habit.id, [
      { date: successDate, status: "success", value: 30 },
      { date: skippedDate, status: "skipped" },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stats/calendar?month=${month}&side=light`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = statsCalendarResponseSchema.parse(JSON.parse(response.body));
    const successDay = body.days.find((day) => day.date === successDate);
    const skippedDay = body.days.find((day) => day.date === skippedDate);

    expect(successDay?.color).toBe("success");
    expect(successDay?.habits[0]?.status).toBe("success");
    expect(skippedDay?.color).toBe("skipped");
  });

  it("uses goal_snapshots for progress and ignores current_goal changes", async () => {
    const auth = await createOnboardedUser("stats-progress@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const today = todayLocal();
    const rangeStart = addDays(today, -29);
    await backdateHabit(habit.id, rangeStart);

    const dates = Array.from({ length: 30 }, (_, index) => addDays(rangeStart, index));

    await seedGoalSnapshots(
      habit.id,
      dates.map((date, index) => ({ date, goal_value: 30 + index })),
    );
    await seedDailyStats(
      habit.id,
      dates.map((date, index) => ({
        date,
        status: index % 5 === 0 ? "fail" : "success",
        value: 30 + index,
        minutes_total: 30 + index,
      })),
    );

    await db
      .update(habits)
      .set({ currentGoal: "99" })
      .where(eq(habits.id, habit.id));

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stats/habits/${habit.id}/progress?period=month`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = statsProgressResponseSchema.parse(JSON.parse(response.body));
    expect(body.side).toBe("light");
    expect(body.chart_mode).toBe("target");
    expect(body.points).toHaveLength(30);
    expect(body.points[0]?.goal).toBe(30);
    expect(body.points.at(-1)?.goal).not.toBe(99);
    expect(body.points.some((point) => point.status === "fail")).toBe(true);
  });

  it("returns progress for deactivated habits", async () => {
    const auth = await createOnboardedUser("stats-inactive@example.com");
    const habit = await createRunningHabit(auth.access_token);
    const today = todayLocal();
    const date = addDays(today, -2);
    await backdateHabit(habit.id, addDays(today, -10));

    await seedGoalSnapshots(habit.id, [{ date, goal_value: 30 }]);
    await seedDailyStats(habit.id, [{ date, status: "success", value: 30 }]);

    await app.inject({
      method: "DELETE",
      url: `/api/v1/habits/${habit.id}`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stats/habits/${habit.id}/progress?period=week`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = statsProgressResponseSchema.parse(JSON.parse(response.body));
    const point = body.points.find((entry) => entry.date === date);
    expect(point?.goal).toBe(30);
    expect(point?.status).toBe("success");
  });

  it("returns heatmap summary for light and dark sides separately", async () => {
    const auth = await createOnboardedUser("stats-summary@example.com");
    const light = await createRunningHabit(auth.access_token);
    const weekStart = getWeekStartMonday(todayLocal());
    await backdateHabit(light.id, weekStart);

    const darkResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        template_id: "smoking",
        baseline_value: 20,
      },
    });
    const dark = habitResponseSchema.parse(JSON.parse(darkResponse.body));
    await backdateHabit(dark.id, weekStart);

    await seedDailyStats(light.id, [{ date: weekStart, status: "success", value: 30 }]);
    await seedDailyStats(dark.id, [{ date: weekStart, status: "fail", value: 25 }]);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/stats/summary?weeks=1",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = statsSummaryResponseSchema.parse(JSON.parse(response.body));
    expect(body.weeks).toHaveLength(1);
    const monday = body.weeks[0]?.days.find((day) => day.date === weekStart);
    expect(monday?.light_color).toBe("success");
    expect(monday?.dark_color).toBe("fail");
  });

  it("excludes inactive habits from current week in summary but keeps them in past weeks", async () => {
    const auth = await createOnboardedUser("stats-summary-inactive@example.com");
    const today = todayLocal();
    const currentWeekStart = getWeekStartMonday(today);
    const previousWeekStart = addDays(currentWeekStart, -7);

    const oldHabit = await createRunningHabit(auth.access_token);
    await backdateHabit(oldHabit.id, previousWeekStart);
    await seedDailyStats(oldHabit.id, [
      { date: previousWeekStart, status: "success", value: 30 },
      { date: currentWeekStart, status: "success", value: 30 },
    ]);

    const beforeDeactivate = await app.inject({
      method: "GET",
      url: "/api/v1/stats/summary?weeks=2",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });
    const beforeBody = statsSummaryResponseSchema.parse(JSON.parse(beforeDeactivate.body));
    const beforeCurrentMonday = beforeBody.weeks[1]?.days.find((day) => day.date === currentWeekStart);
    expect(beforeCurrentMonday?.light_color).toBe("success");

    await app.inject({
      method: "DELETE",
      url: `/api/v1/habits/${oldHabit.id}`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const replacement = await createRunningHabit(auth.access_token);
    expect(replacement.id).not.toBe(oldHabit.id);

    const afterDeactivate = await app.inject({
      method: "GET",
      url: "/api/v1/stats/summary?weeks=2",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });
    const afterBody = statsSummaryResponseSchema.parse(JSON.parse(afterDeactivate.body));

    const previousMonday = afterBody.weeks[0]?.days.find((day) => day.date === previousWeekStart);
    expect(previousMonday?.light_color).toBe("success");

    const afterCurrentMonday = afterBody.weeks[1]?.days.find((day) => day.date === currentWeekStart);
    if (currentWeekStart < today) {
      expect(afterCurrentMonday?.light_color).toBe("fail");
    } else {
      expect(afterCurrentMonday?.light_color).toBe("pending");
    }
  });

  it("returns 404 for unknown habit progress", async () => {
    const auth = await createOnboardedUser("stats-404@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/stats/habits/00000000-0000-4000-8000-000000000001/progress",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("counts abstinence on track as success for today in week strip", async () => {
    const auth = await createOnboardedUser("stats-abstinence-week@example.com");
    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { template_id: "nail_biting", baseline_value: 0 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));
    const today = todayLocal();
    const weekStart = getWeekStartMonday(today);
    await backdateHabit(habit.id, weekStart);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/stats/week?side=dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = statsWeekResponseSchema.parse(JSON.parse(response.body));
    const todayDay = body.days.find((day) => day.date === today);
    expect(todayDay?.color).toBe("success");
    expect(todayDay?.completed).toBe(1);
    expect(todayDay?.total).toBe(1);
  });
});
