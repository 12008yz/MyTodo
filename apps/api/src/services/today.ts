import {
  computeAbstinenceElapsed,
  computeGlobalStreak,
  computeHabitStreak,
  computeNextGoal,
  getUserLocalDate,
  getWeekStartMonday,
  isAbstinenceTimerHabit,
  isDateInRange,
  type DayCheckin,
} from "@mytodo/domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { checkins, habits, type Habit, type User } from "../db/schema/index.js";
import { toHabitResponse } from "../lib/habit-mapper.js";
import { previewStatusFromCheckin, toProgressionHabit } from "../lib/habit-progression.js";
import type { DoomScrollService } from "./doom-scroll.js";
import type { PomodoroService } from "./pomodoro.js";

type Side = "light" | "dark";

type CheckinRow = typeof checkins.$inferSelect;

export class TodayService {
  constructor(
    private readonly db: Database,
    private readonly pomodoroService: PomodoroService,
    private readonly doomScrollService: DoomScrollService,
  ) {}

  async getLightDashboard(user: User) {
    return this.getDashboard(user, "light");
  }

  async getDarkDashboard(user: User) {
    const dashboard = await this.getDashboard(user, "dark");
    const now = new Date();
    const activeDoomByHabit = new Map(
      (await this.doomScrollService.listActiveForUser(user.id)).map((session) => [
        session.habit_id,
        session,
      ]),
    );

    return {
      date: dashboard.date,
      greeting_name: user.name,
      stats: dashboard.stats,
      habits: dashboard.habits.map((habit) => ({
        ...habit,
        timer: isAbstinenceTimerHabit(habit.phase)
            ? this.buildTimer(habit.last_relapse_at, now)
            : null,
        doom_scroll_active: activeDoomByHabit.get(habit.id) ?? null,
      })),
    };
  }

  async getHabitTimer(userId: string, habitId: string) {
    const habit = await this.getOwnedHabit(userId, habitId);

    if (!habit || !isAbstinenceTimerHabit(habit.phase as "reduction" | "abstinence") || habit.lastRelapseAt === null) {
      return null;
    }

    return {
      habit_id: habit.id,
      timer: this.buildTimer(habit.lastRelapseAt.toISOString(), new Date()),
    };
  }

  async habitExists(userId: string, habitId: string) {
    const habit = await this.getOwnedHabit(userId, habitId);
    return habit !== null;
  }

  private async getDashboard(user: User, side: Side) {
    const today = getUserLocalDate(new Date(), user.timezone);
    const weekStart = getWeekStartMonday(today);
    const userHabits = await this.listHabits(user.id, side);
    const habitIds = userHabits.map((habit) => habit.id);
    const allCheckins = await this.listCheckinsForHabits(habitIds);
    const checkinsByHabit = this.groupCheckinsByHabit(allCheckins);
    const todayCheckins = this.indexTodayCheckins(allCheckins, today);

    const stats = await this.buildStats(
      user,
      userHabits,
      allCheckins,
      checkinsByHabit,
      today,
      weekStart,
      side,
    );

    const habitsPayload = userHabits.map((habit) => {
      const checkin = todayCheckins.get(habit.id) ?? null;
      const dayStatus = previewStatusFromCheckin(checkin?.status);
      const previewNextGoal = computeNextGoal(toProgressionHabit(habit), dayStatus);
      const activeFrom = getUserLocalDate(habit.createdAt, user.timezone);
      const streakDays = computeHabitStreak(
        (checkinsByHabit.get(habit.id) ?? []).map((row) => ({
          date: row.date,
          status: row.status as DayCheckin["status"],
        })),
        today,
        activeFrom,
        habit.type as "target" | "limit" | "abstinence",
        habit.phase as "reduction" | "abstinence",
      );

      return {
        ...toHabitResponse(habit),
        checkin: checkin
          ? {
              id: checkin.id,
              date: checkin.date,
              status: checkin.status as "success" | "fail" | "pending" | "skipped",
              value: checkin.value === null ? null : Number(checkin.value),
              updated_at: checkin.updatedAt.toISOString(),
              current_goal: Number(habit.currentGoal),
              preview_next_goal: previewNextGoal,
            }
          : null,
        preview_next_goal: previewNextGoal,
        streak_days: streakDays,
      };
    });

    const minutesLoggedToday =
      side === "light"
        ? this.sumMinutesToday(userHabits, todayCheckins)
        : this.sumMinutesToday(
            userHabits.filter((habit) => habit.unit === "minutes"),
            todayCheckins,
          );

    return {
      date: today,
      greeting_name: user.name,
      daily_budget_min: user.dailyBudgetMin,
      minutes_logged_today: minutesLoggedToday,
      stats,
      habits: habitsPayload,
    };
  }

  private async buildStats(
    user: User,
    userHabits: Habit[],
    allCheckins: CheckinRow[],
    checkinsByHabit: Map<string, CheckinRow[]>,
    today: string,
    weekStart: string,
    side: Side,
  ) {
    const todayRows = allCheckins.filter((row) => row.date === today);
    const completedToday = todayRows.filter((row) => row.status === "success").length;
    const relapsesThisWeek = allCheckins.filter(
      (row) =>
        row.status === "fail" &&
        isDateInRange(row.date, weekStart, today) &&
        userHabits.some((habit) => habit.id === row.habitId),
    ).length;

    const minutesToday =
      side === "light"
        ? this.sumMinutesToday(userHabits, this.indexTodayCheckins(allCheckins, today))
        : this.sumMinutesToday(
            userHabits.filter((habit) => habit.unit === "minutes"),
            this.indexTodayCheckins(allCheckins, today),
          );

    const streakRecords = new Map<string, DayCheckin[]>();
    const habitScopes = userHabits.map((habit) => ({
      id: habit.id,
      activeFrom: getUserLocalDate(habit.createdAt, user.timezone),
      type: habit.type as "target" | "limit" | "abstinence",
      phase: habit.phase as "reduction" | "abstinence",
    }));

    for (const habit of userHabits) {
      streakRecords.set(
        habit.id,
        (checkinsByHabit.get(habit.id) ?? []).map((row) => ({
          date: row.date,
          status: row.status as DayCheckin["status"],
        })),
      );
    }

    const pomodorosToday = await this.pomodoroService.countCompletedToday(user.id, user.timezone);

    return {
      completed_today: completedToday,
      relapses_this_week: relapsesThisWeek,
      minutes_today: minutesToday,
      pomodoros_today: pomodorosToday,
      streak_days: computeGlobalStreak(streakRecords, habitScopes, today),
    };
  }

  private sumMinutesToday(userHabits: Habit[], todayCheckins: Map<string, CheckinRow>) {
    return userHabits
      .filter((habit) => habit.unit === "minutes")
      .reduce((total, habit) => {
        const checkin = todayCheckins.get(habit.id);
        if (checkin?.value == null) {
          return total;
        }

        return total + Number(checkin.value);
      }, 0);
  }

  private buildTimer(lastRelapseAt: string | null, now: Date) {
    if (!lastRelapseAt) {
      return null;
    }

    const elapsed = computeAbstinenceElapsed(new Date(lastRelapseAt), now);

    return {
      started_at: lastRelapseAt,
      elapsed,
    };
  }

  private indexTodayCheckins(rows: CheckinRow[], today: string) {
    const map = new Map<string, CheckinRow>();

    for (const row of rows) {
      if (row.date === today) {
        map.set(row.habitId, row);
      }
    }

    return map;
  }

  private groupCheckinsByHabit(rows: CheckinRow[]) {
    const map = new Map<string, CheckinRow[]>();

    for (const row of rows) {
      const existing = map.get(row.habitId) ?? [];
      existing.push(row);
      map.set(row.habitId, existing);
    }

    return map;
  }

  private async listHabits(userId: string, side: Side) {
    return this.db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.side, side), eq(habits.isActive, true)))
      .orderBy(asc(habits.createdAt));
  }

  private async listCheckinsForHabits(habitIds: string[]) {
    if (habitIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(checkins)
      .where(inArray(checkins.habitId, habitIds))
      .orderBy(asc(checkins.date));
  }

  private async getOwnedHabit(userId: string, habitId: string): Promise<Habit | null> {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId), eq(habits.isActive, true)))
      .limit(1);

    return habit ?? null;
  }
}
