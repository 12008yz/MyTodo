import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { computeNextGoal, getUserLocalDate } from "@mytodo/domain";
import {
  authResponseSchema,
  checkinResponseSchema,
  englishCompleteResponseSchema,
  habitResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { CheckinService } from "../src/services/checkins.js";
import { DoomScrollService } from "../src/services/doom-scroll.js";
import { DayCloseService } from "../src/services/day-close.js";
import {
  checkins,
  dailyStats,
  englishLessons,
  englishSettings,
  goalSnapshots,
  habits,
  users,
} from "../src/db/schema/index.js";
import { toProgressionHabit } from "../src/lib/habit-progression.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

const CLOSE_DATE = "2026-06-18";

function shiftDate(date: string, deltaDays: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return parsed.toISOString().slice(0, 10);
}

describe("Day close worker", () => {
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
        name: "Worker User",
        age: 30,
        gender: "male",
      },
    });

    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        weight_kg: 80,
        height_cm: 180,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
        timezone: "UTC",
      },
    });

    const [user] = await db.select().from(users).where(eq(users.email, email));
    return { auth, user: user! };
  }

  async function backdateOnboarding(userId: string, beforeDate: string) {
    const anchor = new Date(`${shiftDate(beforeDate, -3)}T12:00:00.000Z`);
    await db
      .update(users)
      .set({ onboardingCompletedAt: anchor, createdAt: anchor })
      .where(eq(users.id, userId));
    const [row] = await db.select().from(users).where(eq(users.id, userId));
    return row!;
  }

  it("closes abstinence as success and writes daily_stats", async () => {
    const { auth, user } = await createOnboardedUser("abstinence-close@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "nail_biting", baseline_value: 0 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const [checkin] = await db
      .select()
      .from(checkins)
      .where(eq(checkins.habitId, habit.id));
    const [stat] = await db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.habitId, habit.id));

    expect(checkin?.status).toBe("success");
    expect(stat?.status).toBe("success");
  });

  it("closes empty limit habit as fail", async () => {
    const { auth, user } = await createOnboardedUser("limit-close@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "smoking", baseline_value: 20 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const [stat] = await db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.habitId, habit.id));

    expect(stat?.status).toBe("fail");
  });

  it("closes light habit with partial pending checkin as fail", async () => {
    const { auth, user } = await createOnboardedUser("light-pending-close@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "running", baseline_value: 10 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    const checkinResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: CLOSE_DATE,
        value: 3,
      },
    });
    const checkin = checkinResponseSchema.parse(JSON.parse(checkinResponse.body));
    expect(checkin.status).toBe("pending");

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const [updatedCheckin] = await db
      .select()
      .from(checkins)
      .where(eq(checkins.habitId, habit.id));
    const [stat] = await db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.habitId, habit.id));

    expect(updatedCheckin?.status).toBe("fail");
    expect(Number(updatedCheckin?.value)).toBe(3);
    expect(stat?.status).toBe("fail");
  });

  it("closes books habit with partial pending checkin as fail", async () => {
    const { auth, user } = await createOnboardedUser("books-pending-close@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    const checkinResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: CLOSE_DATE,
        value: 3,
      },
    });
    const checkin = checkinResponseSchema.parse(JSON.parse(checkinResponse.body));
    expect(checkin.status).toBe("pending");

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const [updatedCheckin] = await db
      .select()
      .from(checkins)
      .where(eq(checkins.habitId, habit.id));
    const [stat] = await db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.habitId, habit.id));

    expect(updatedCheckin?.status).toBe("fail");
    expect(Number(updatedCheckin?.value)).toBe(3);
    expect(stat?.status).toBe("fail");
  });

  it("applies preview_next_goal after successful light habit close", async () => {
    const { auth, user } = await createOnboardedUser("light-close@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    const checkinResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: CLOSE_DATE,
        value: habit.current_goal,
      },
    });
    const checkin = checkinResponseSchema.parse(JSON.parse(checkinResponse.body));
    expect(checkin.preview_next_goal).toBe(habit.current_goal);

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const [updatedHabit] = await db.select().from(habits).where(eq(habits.id, habit.id));
    const [snapshot] = await db
      .select()
      .from(goalSnapshots)
      .where(eq(goalSnapshots.habitId, habit.id));

    expect(Number(updatedHabit?.currentGoal)).toBe(checkin.preview_next_goal);
    expect(updatedHabit?.successDaysAtGoal).toBe(1);
    expect(Number(snapshot?.goalValue)).toBe(habit.current_goal);
  });

  it("increases light habit goal after interval of successful day closes", async () => {
    const { auth, user } = await createOnboardedUser("light-third-close@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await db
      .update(habits)
      .set({ successDaysAtGoal: 2 })
      .where(eq(habits.id, habit.id));

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: CLOSE_DATE,
        value: habit.current_goal,
      },
    });

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const [updatedHabit] = await db.select().from(habits).where(eq(habits.id, habit.id));
    expect(Number(updatedHabit?.currentGoal)).toBe(habit.current_goal + habit.growth_step);
    expect(updatedHabit?.successDaysAtGoal).toBe(0);
  });

  it("advances english current_day only after day close with success", async () => {
    const { auth, user } = await createOnboardedUser("english-close@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };
    const today = getUserLocalDate(new Date(), user.timezone);

    for (const lesson of [
      { dayNumber: 1, title: "Day 1", videoUrl: "https://example.com/1", durationSec: 600 },
      { dayNumber: 2, title: "Day 2", videoUrl: "https://example.com/2", durationSec: 600 },
    ]) {
      await db.insert(englishLessons).values(lesson);
    }

    await app.inject({
      method: "PATCH",
      url: "/api/v1/english/settings",
      headers,
      payload: { is_enabled: true },
    });

    const completeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/english/complete",
      headers,
      payload: { watched_sec: 600 },
    });
    const complete = englishCompleteResponseSchema.parse(JSON.parse(completeResponse.body));
    expect(complete.current_day).toBe(1);
    expect(complete.preview_next_day).toBe(2);

    const userForClose = await backdateOnboarding(user.id, today);
    await dayCloseService.closeDayForUser(userForClose, today);

    const [settings] = await db.select().from(englishSettings);
    expect(settings?.currentDay).toBe(2);
  });

  it("is idempotent for habit day close", async () => {
    const { auth, user } = await createOnboardedUser("idempotent@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: habit.id, date: CLOSE_DATE, value: habit.current_goal },
    });

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);
    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const stats = await db.select().from(dailyStats).where(eq(dailyStats.habitId, habit.id));
    const snapshots = await db
      .select()
      .from(goalSnapshots)
      .where(eq(goalSnapshots.habitId, habit.id));

    expect(stats).toHaveLength(1);
    expect(snapshots).toHaveLength(1);
  });

  it("transitions smoking to abstinence when goal reaches zero after close", async () => {
    const { auth, user } = await createOnboardedUser("smoking-phase@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "smoking", baseline_value: 1 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));
    expect(habit.current_goal).toBe(1);

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: habit.id, date: CLOSE_DATE, value: 0 },
    });

    await db
      .update(habits)
      .set({ successDaysAtGoal: 2 })
      .where(eq(habits.id, habit.id));

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const [updated] = await db.select().from(habits).where(eq(habits.id, habit.id));
    expect(updated?.phase).toBe("abstinence");
    expect(Number(updated?.currentGoal)).toBe(0);
    expect(updated?.lastRelapseAt).not.toBeNull();
  });

  it("is idempotent for english day close after success", async () => {
    const { auth, user } = await createOnboardedUser("english-idempotent@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };
    const today = getUserLocalDate(new Date(), user.timezone);

    await db.insert(englishLessons).values({
      dayNumber: 1,
      title: "Day 1",
      videoUrl: "https://example.com/1",
      durationSec: 600,
    });

    await app.inject({
      method: "PATCH",
      url: "/api/v1/english/settings",
      headers,
      payload: { is_enabled: true },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/english/complete",
      headers,
      payload: { watched_sec: 600 },
    });

    const userForClose = await backdateOnboarding(user.id, today);
    await dayCloseService.closeDayForUser(userForClose, today);
    await dayCloseService.closeDayForUser(userForClose, today);

    const [settings] = await db.select().from(englishSettings);
    expect(settings?.currentDay).toBe(2);
  });

  it("matches computeNextGoal for dark limit success close", async () => {
    const { auth, user } = await createOnboardedUser("dark-goal@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "smoking", baseline_value: 20 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: habit.id, date: CLOSE_DATE, value: 18 },
    });

    const [habitRow] = await db.select().from(habits).where(eq(habits.id, habit.id));
    const expectedNext = computeNextGoal(toProgressionHabit(habitRow!), "success");

    await dayCloseService.closeDayForUser(user, CLOSE_DATE);

    const [updated] = await db.select().from(habits).where(eq(habits.id, habit.id));
    expect(Number(updated?.currentGoal)).toBe(expectedNext);
  });
});
