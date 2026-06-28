import {
  buildDailyPlan,
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
import { AWARENESS_SESSION_MIN, isCompanionLightHabit, isNutritionHabit, resolveHabitDisplayName, type HabitCategoryKey, type HabitTemplateId, type HabitUnit } from "@mytodo/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { checkins, habits, type Habit, type User } from "../db/schema/index.js";
import { toHabitResponse } from "../lib/habit-mapper.js";
import { previewStatusFromCheckin, toProgressionHabit } from "../lib/habit-progression.js";
import type { DoomScrollService } from "./doom-scroll.js";
import type { HabitSessionService } from "./habit-sessions.js";
import type { ReadingProgressService } from "./reading-progress.js";
import type { NutritionLogService } from "./nutrition-log.js";
import type { PomodoroService } from "./pomodoro.js";
import type { CheckinService } from "./checkins.js";
import { buildWarmupDayPayload, isWarmupDayForUser } from "../lib/warmup.js";

type Side = "light" | "dark";

function habitPlanName(habit: Habit): string {
  return resolveHabitDisplayName({
    name: habit.name,
    template_id: (habit.templateId as HabitTemplateId | null) ?? null,
    is_custom: habit.isCustom,
  });
}

type CheckinRow = typeof checkins.$inferSelect;

export class TodayService {
  constructor(
    private readonly db: Database,
    private readonly pomodoroService: PomodoroService,
    private readonly doomScrollService: DoomScrollService,
    private readonly habitSessionService: HabitSessionService,
    private readonly readingProgressService: ReadingProgressService,
    private readonly nutritionLogService: NutritionLogService,
    private readonly checkinService: CheckinService,
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
      daily_plan: dashboard.daily_plan,
      warmup_day: dashboard.warmup_day,
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
    await this.checkinService.ensureEarlyRiseWeekendSkips(user, today);
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

    const habitsPayload = await this.buildHabitsPayload(
      user,
      userHabits,
      checkinsByHabit,
      todayCheckins,
      today,
    );

    const minutesLoggedToday =
      side === "light"
        ? this.sumMinutesToday(userHabits, todayCheckins)
        : this.sumMinutesToday(
            userHabits.filter((habit) => habit.unit === "minutes"),
            todayCheckins,
          );
    const dailyPlan = await this.buildDailyPlanForSide(user, side, userHabits, todayCheckins, today);
    const emptyPlan = buildDailyPlan({
      date: today,
      budgetMin: user.dailyBudgetMin,
      habits: [],
    });
    const warmup_day = buildWarmupDayPayload(user, today);

    return {
      date: today,
      greeting_name: user.name,
      daily_budget_min: user.dailyBudgetMin,
      minutes_logged_today: minutesLoggedToday,
      stats,
      habits: habitsPayload,
      daily_plan: side === "light" ? (dailyPlan ?? emptyPlan) : (dailyPlan ?? undefined),
      warmup_day,
    };
  }

  private async buildDailyPlanForSide(
    user: User,
    side: Side,
    userHabits: Habit[],
    todayCheckins: Map<string, CheckinRow>,
    today: string,
  ) {
    const completedBlockMeta = await this.habitSessionService.listCompletedBlockMetaForDate(
      user.id,
      user.timezone,
      today,
    );
    const completedBlockIds = new Set(completedBlockMeta.keys());
    const activeBlockId = await this.habitSessionService.findActiveBlockIdForUser(user.id);

    if (side === "light") {
      const habitsForPlan = userHabits.map((habit) => {
        const checkin = todayCheckins.get(habit.id);
        return {
          id: habit.id,
          name: habitPlanName(habit),
          icon: habit.icon,
          unit: (habit.unit ?? "minutes") as HabitUnit,
          current_goal: Number(habit.currentGoal),
          checkin_value: checkin?.value == null ? 0 : Number(checkin.value),
          template_id: habit.templateId as HabitTemplateId | null,
          category_key: habit.categoryKey as HabitCategoryKey | null,
        };
      });

      return buildDailyPlan({
        date: today,
        budgetMin: user.dailyBudgetMin,
        habits: habitsForPlan,
        completedBlockIds,
        activeBlockId,
        completedBlockMeta,
      });
    }

    const darkAwarenessHabits = userHabits.filter((habit) => {
      if (habit.type !== "limit" || habit.templateId === "social_media") {
        return false;
      }

      return todayCheckins.get(habit.id)?.status !== "success";
    });

    if (darkAwarenessHabits.length === 0) {
      return null;
    }

    const basePlan = buildDailyPlan({
      date: today,
      budgetMin: darkAwarenessHabits.length * AWARENESS_SESSION_MIN,
      habits: darkAwarenessHabits.map((habit) => ({
        id: habit.id,
        name: habitPlanName(habit),
        icon: habit.icon,
        unit: (habit.unit ?? "minutes") as HabitUnit,
        current_goal: AWARENESS_SESSION_MIN,
        checkin_value: 0,
      })),
      completedBlockIds,
      activeBlockId,
      completedBlockMeta,
    });

    return {
      ...basePlan,
      blocks: basePlan.blocks.map((block) => ({
        ...block,
        expected_yield: 0,
      })),
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
        !isWarmupDayForUser(user, row.date) &&
        userHabits.some((habit) => habit.id === row.habitId),
    ).length;

    const minutesToday =
      side === "light"
        ? this.sumMinutesToday(userHabits, this.indexTodayCheckins(allCheckins, today))
        : this.sumMinutesToday(
            userHabits.filter((habit) => habit.unit === "minutes"),
            this.indexTodayCheckins(allCheckins, today),
          );

    const streakHabits = userHabits.filter(
      (habit) => !isCompanionLightHabit({ category_key: habit.categoryKey, name: habit.name }),
    );
    const streakRecords = new Map<string, DayCheckin[]>();
    const habitScopes = streakHabits.map((habit) => ({
      id: habit.id,
      activeFrom: getUserLocalDate(habit.createdAt, user.timezone),
      type: habit.type as "target" | "limit" | "abstinence",
      phase: habit.phase as "reduction" | "abstinence",
    }));

    for (const habit of streakHabits) {
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

  private async buildHabitsPayload(
    user: User,
    userHabits: Habit[],
    checkinsByHabit: Map<string, CheckinRow[]>,
    todayCheckins: Map<string, CheckinRow>,
    today: string,
  ) {
    const booksHabitIds = userHabits
      .filter((habit) => habit.templateId === "books")
      .map((habit) => habit.id);
    const nutritionHabitIds = userHabits
      .filter((habit) => isNutritionHabit({ category_key: habit.categoryKey, name: habit.name }))
      .map((habit) => habit.id);
    const readingByHabit = await this.readingProgressService.listForHabits(
      user.id,
      booksHabitIds,
    );
    const nutritionLogByHabit = await this.nutritionLogService.listForHabits(
      user.id,
      nutritionHabitIds,
      today,
    );

    return userHabits.map((habit) => {
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

      const reading = readingByHabit.get(habit.id) ?? null;
      const nutritionLog = nutritionLogByHabit.get(habit.id) ?? null;

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
        ...(habit.templateId === "books" ? { reading } : {}),
        ...(isNutritionHabit({ category_key: habit.categoryKey, name: habit.name })
          ? { nutrition_log: nutritionLog }
          : {}),
      };
    });
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
