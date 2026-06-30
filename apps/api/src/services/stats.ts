import {
  addDays,
  computeDayColor,
  getMonthRange,
  getProgressPeriodRange,
  getUserLocalDate,
  getWeekStartMonday,
  isWeekendDate,
  listDatesInclusive,
  usesAbstinenceStreakRules,
  type DayColor,
  type HabitDayStatus,
} from "@mytodo/domain";
import { isCompanionLightHabit, isEarlyRiseCategoryKey, resolveHabitDisplayName, type HabitTemplateId } from "@mytodo/shared";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  checkins,
  dailyStats,
  goalSnapshots,
  habits,
  type Habit,
  type User,
} from "../db/schema/index.js";

type Side = "light" | "dark";

type HabitScope = {
  habit: Habit;
  activeFrom: string;
};

type ResolvedHabitDay = {
  habitId: string;
  name: string;
  side: Side;
  type: "target" | "limit" | "abstinence";
  phase: "reduction" | "abstinence";
  unit: import("@mytodo/shared").HabitUnit | null;
  templateId: HabitTemplateId | null;
  status: HabitDayStatus;
  value: number | null;
  minutesTotal: number;
  goal: number | null;
};

export class StatsService {
  constructor(private readonly db: Database) {}

  async getWeek(user: User, side: Side, weekStart?: string) {
    const today = getUserLocalDate(new Date(), user.timezone);
    const start = weekStart ?? getWeekStartMonday(today);
    const dates = listDatesInclusive(start, addDays(start, 6));
    const scopedHabits = await this.listScopedHabits(user, side, { activeOnly: true });
    const resolved = await this.resolveDays(user, scopedHabits, dates);

    return {
      week_start: start,
      side,
      days: dates.map((date) => this.summarizeDay(date, resolved.get(date) ?? [])),
    };
  }

  async getCalendar(user: User, month: string, side?: Side) {
    const { start, end } = getMonthRange(month);
    const dates = listDatesInclusive(start, end);
    const scopedHabits = side
      ? await this.listScopedHabits(user, side)
      : await this.listAllScopedHabits(user);
    const resolved = await this.resolveDays(user, scopedHabits, dates);

    return {
      month,
      days: dates.map((date) => {
        const habitsForDay = resolved.get(date) ?? [];

        return {
          date,
          color: computeDayColor(habitsForDay.map((row) => row.status)),
          habits: habitsForDay.map((row) => ({
            habit_id: row.habitId,
            name: row.name,
            side: row.side,
            type: row.type,
            phase: row.phase,
            unit: row.unit,
            template_id: row.templateId,
            status: row.status,
            value: row.value,
            goal: row.goal,
            minutes_total: row.minutesTotal,
          })),
        };
      }),
    };
  }

  async getMonthSummary(user: User, month: string, side?: Side) {
    const { start, end } = getMonthRange(month);
    const scopedHabits = side
      ? await this.listScopedHabits(user, side)
      : await this.listAllScopedHabits(user);
    const habitIds = scopedHabits.map((scope) => scope.habit.id);

    if (habitIds.length === 0) {
      return {
        month,
        side: side ?? null,
        success_days: 0,
        success_rate: 0,
        relapses: 0,
        skipped_days: 0,
        closed_days: 0,
      };
    }

    const dates = listDatesInclusive(start, end);
    const statsRows = await this.listDailyStats(habitIds, start, end);
    const statsByKey = new Set(statsRows.map((row) => `${row.habitId}:${row.date}`));
    const resolved = await this.resolveDays(user, scopedHabits, dates);

    let successDays = 0;
    let relapses = 0;
    let skippedDays = 0;
    let closedDays = 0;

    for (const date of dates) {
      const rows = resolved.get(date) ?? [];
      if (rows.length === 0) {
        continue;
      }

      const fullyClosed = rows.every((row) => statsByKey.has(`${row.habitId}:${date}`));
      if (!fullyClosed) {
        continue;
      }

      closedDays += 1;
      const color = computeDayColor(rows.map((row) => row.status));

      if (color === "success") {
        successDays += 1;
      } else if (color === "fail") {
        relapses += 1;
      } else if (color === "skipped") {
        skippedDays += 1;
      }
    }

    const successRate = closedDays === 0 ? 0 : Math.round((successDays / closedDays) * 100);

    return {
      month,
      side: side ?? null,
      success_days: successDays,
      success_rate: successRate,
      relapses,
      skipped_days: skippedDays,
      closed_days: closedDays,
    };
  }

  async getHabitProgress(user: User, habitId: string, period: "week" | "month" | "quarter") {
    const habit = await this.getOwnedHabit(user.id, habitId, { includeInactive: true });
    if (!habit) {
      return null;
    }

    const today = getUserLocalDate(new Date(), user.timezone);
    const activeFrom = getUserLocalDate(habit.createdAt, user.timezone);
    const { start, end } = getProgressPeriodRange(today, period);
    const dates = listDatesInclusive(start, end).filter((date) => date >= activeFrom);
    const scopedHabits = [{ habit, activeFrom }];
    const resolved = await this.resolveDays(user, scopedHabits, dates);
    const points = dates.map((date) => {
      const row = resolved.get(date)?.[0];

      return {
        date,
        goal: row?.goal ?? null,
        value: row?.value ?? null,
        status: row?.status ?? null,
        minutes_total: row?.minutesTotal ?? 0,
      };
    });

    const chartMode =
      habit.type === "abstinence" || habit.phase === "abstinence"
        ? ("abstinence" as const)
        : habit.type === "limit"
          ? ("limit" as const)
          : ("target" as const);

    return {
      habit_id: habit.id,
      period,
      start_date: dates[0] ?? start,
      end_date: dates.at(-1) ?? end,
      side: habit.side as Side,
      type: habit.type as "target" | "limit" | "abstinence",
      phase: habit.phase as "reduction" | "abstinence",
      unit: (habit.unit as import("@mytodo/shared").HabitUnit | null) ?? null,
      chart_mode: chartMode,
      points,
    };
  }

  async getSummary(user: User, weeks: number) {
    const today = getUserLocalDate(new Date(), user.timezone);
    const currentWeekStart = getWeekStartMonday(today);
    const firstWeekStart = addDays(currentWeekStart, -(weeks - 1) * 7);
    const end = addDays(currentWeekStart, 6);
    const dates = listDatesInclusive(firstWeekStart, end);

    const [lightHabitsAll, darkHabitsAll, lightHabitsActive, darkHabitsActive] = await Promise.all([
      this.listScopedHabits(user, "light"),
      this.listScopedHabits(user, "dark"),
      this.listScopedHabits(user, "light", { activeOnly: true }),
      this.listScopedHabits(user, "dark", { activeOnly: true }),
    ]);
    const lightActiveIds = new Set(lightHabitsActive.map((scope) => scope.habit.id));
    const darkActiveIds = new Set(darkHabitsActive.map((scope) => scope.habit.id));

    const [lightResolved, darkResolved] = await Promise.all([
      this.resolveDays(user, lightHabitsAll, dates),
      this.resolveDays(user, darkHabitsAll, dates),
    ]);

    const payload = [];

    for (let index = 0; index < weeks; index += 1) {
      const weekStart = addDays(firstWeekStart, index * 7);
      const weekDates = listDatesInclusive(weekStart, addDays(weekStart, 6));

      payload.push({
        week_start: weekStart,
        days: weekDates.map((date) => ({
          date,
          light_color: this.colorForDay(
            this.filterSummaryDayRows(
              date,
              lightResolved.get(date) ?? [],
              currentWeekStart,
              lightActiveIds,
            ),
          ),
          dark_color: this.colorForDay(
            this.filterSummaryDayRows(
              date,
              darkResolved.get(date) ?? [],
              currentWeekStart,
              darkActiveIds,
            ),
          ),
        })),
      });
    }

    return { weeks: payload };
  }

  private summarizeDay(date: string, rows: ResolvedHabitDay[]) {
    const completed = rows.filter((row) => row.status === "success").length;

    return {
      date,
      color: this.colorForDay(rows),
      completed,
      total: rows.length,
    };
  }

  private colorForDay(rows: ResolvedHabitDay[]): DayColor {
    return computeDayColor(rows.map((row) => row.status));
  }

  private filterSummaryDayRows(
    date: string,
    rows: ResolvedHabitDay[],
    currentWeekStart: string,
    activeHabitIds: Set<string>,
  ): ResolvedHabitDay[] {
    const currentWeekEnd = addDays(currentWeekStart, 6);
    if (date < currentWeekStart || date > currentWeekEnd) {
      return rows;
    }

    return rows.filter((row) => activeHabitIds.has(row.habitId));
  }

  private async resolveDays(user: User, scopedHabits: HabitScope[], dates: string[]) {
    if (scopedHabits.length === 0 || dates.length === 0) {
      return new Map<string, ResolvedHabitDay[]>();
    }

    const today = getUserLocalDate(new Date(), user.timezone);
    const habitIds = scopedHabits.map((scope) => scope.habit.id);
    const start = dates[0]!;
    const end = dates.at(-1)!;

    const [statsRows, snapshotRows, checkinRows] = await Promise.all([
      this.listDailyStats(habitIds, start, end),
      this.listGoalSnapshots(habitIds, start, end),
      this.listCheckins(habitIds, start, end),
    ]);

    const statsByKey = new Map(
      statsRows.map((row) => [`${row.habitId}:${row.date}`, row] as [string, (typeof statsRows)[number]]),
    );
    const snapshotsByKey = new Map(
      snapshotRows.map((row) => [`${row.habitId}:${row.date}`, row] as [string, (typeof snapshotRows)[number]]),
    );
    const checkinsByKey = new Map(
      checkinRows.map((row) => [`${row.habitId}:${row.date}`, row] as [string, (typeof checkinRows)[number]]),
    );

    const resolved = new Map<string, ResolvedHabitDay[]>();

    for (const date of dates) {
      const rows: ResolvedHabitDay[] = [];

      for (const scope of scopedHabits) {
        if (date < scope.activeFrom) {
          continue;
        }

        if (isCompanionLightHabit({ category_key: scope.habit.categoryKey, name: scope.habit.name })) {
          continue;
        }

        const key = `${scope.habit.id}:${date}`;
        const stat = statsByKey.get(key);
        const snapshot = snapshotsByKey.get(key);
        const checkin = checkinsByKey.get(key);
        const status = this.resolveStatus(scope.habit, date, today, stat?.status, checkin?.status);
        const goal =
          snapshot?.goalValue != null
            ? Number(snapshot.goalValue)
            : date === today
              ? Number(scope.habit.currentGoal)
              : null;

        rows.push({
          habitId: scope.habit.id,
          name: resolveHabitDisplayName({
            name: scope.habit.name,
            template_id: (scope.habit.templateId as HabitTemplateId | null) ?? null,
            is_custom: scope.habit.isCustom,
          }),
          side: scope.habit.side as Side,
          type: scope.habit.type as "target" | "limit" | "abstinence",
          phase: scope.habit.phase as "reduction" | "abstinence",
          unit: (scope.habit.unit as import("@mytodo/shared").HabitUnit | null) ?? null,
          templateId: (scope.habit.templateId as HabitTemplateId | null) ?? null,
          status,
          value: stat?.value != null ? Number(stat.value) : checkin?.value != null ? Number(checkin.value) : null,
          minutesTotal:
            stat?.minutesTotal ??
            (scope.habit.templateId === "social_media" && checkin?.value != null
              ? Number(checkin.value)
              : 0),
          goal,
        });
      }

      resolved.set(date, rows);
    }

    return resolved;
  }

  private resolveStatus(
    habit: Habit,
    date: string,
    today: string,
    statStatus?: string,
    checkinStatus?: string,
  ): HabitDayStatus {
    if (isCompanionLightHabit({ category_key: habit.categoryKey, name: habit.name })) {
      return "skipped";
    }

    if (isEarlyRiseCategoryKey(habit.categoryKey) && isWeekendDate(date)) {
      return "skipped";
    }

    if (statStatus === "success" || statStatus === "fail" || statStatus === "skipped") {
      return statStatus;
    }

    if (date > today) {
      return "pending";
    }

    if (checkinStatus === "success" || checkinStatus === "fail" || checkinStatus === "skipped") {
      return checkinStatus;
    }

    if (checkinStatus === "pending") {
      return date === today ? "pending" : "fail";
    }

    if (
      usesAbstinenceStreakRules(
        habit.type as "target" | "limit" | "abstinence",
        habit.phase as "reduction" | "abstinence",
      )
    ) {
      return "success";
    }

    if (date === today) {
      return "pending";
    }

    return "fail";
  }

  private async listScopedHabits(
    user: User,
    side: Side,
    options: { activeOnly?: boolean } = {},
  ): Promise<HabitScope[]> {
    const conditions = [eq(habits.userId, user.id), eq(habits.side, side)];

    if (options.activeOnly) {
      conditions.push(eq(habits.isActive, true));
    }

    const rows = await this.db
      .select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(asc(habits.createdAt));

    return rows.map((habit) => ({
      habit,
      activeFrom: getUserLocalDate(habit.createdAt, user.timezone),
    }));
  }

  private async listAllScopedHabits(user: User): Promise<HabitScope[]> {
    const rows = await this.db
      .select()
      .from(habits)
      .where(eq(habits.userId, user.id))
      .orderBy(asc(habits.createdAt));

    return rows.map((habit) => ({
      habit,
      activeFrom: getUserLocalDate(habit.createdAt, user.timezone),
    }));
  }

  private async listDailyStats(habitIds: string[], start: string, end: string) {
    return this.db
      .select()
      .from(dailyStats)
      .where(
        and(
          inArray(dailyStats.habitId, habitIds),
          gte(dailyStats.date, start),
          lte(dailyStats.date, end),
        ),
      );
  }

  private async listGoalSnapshots(habitIds: string[], start: string, end: string) {
    return this.db
      .select()
      .from(goalSnapshots)
      .where(
        and(
          inArray(goalSnapshots.habitId, habitIds),
          gte(goalSnapshots.date, start),
          lte(goalSnapshots.date, end),
        ),
      );
  }

  private async listCheckins(habitIds: string[], start: string, end: string) {
    return this.db
      .select()
      .from(checkins)
      .where(
        and(inArray(checkins.habitId, habitIds), gte(checkins.date, start), lte(checkins.date, end)),
      );
  }

  private async getOwnedHabit(
    userId: string,
    habitId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<Habit | null> {
    const conditions = [eq(habits.id, habitId), eq(habits.userId, userId)];

    if (!options.includeInactive) {
      conditions.push(eq(habits.isActive, true));
    }

    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(...conditions))
      .limit(1);

    return habit ?? null;
  }
}
