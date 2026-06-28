import type { CheckinStatus } from "./checkin.js";

export type DayCheckin = {
  date: string;
  status: CheckinStatus | "pending";
};

const STREAK_CONTINUE: ReadonlySet<string> = new Set(["success", "skipped"]);

export function usesAbstinenceStreakRules(
  habitType: "target" | "limit" | "abstinence",
  habitPhase: "reduction" | "abstinence",
): boolean {
  return habitType === "abstinence" || habitPhase === "abstinence";
}

export function isAbstinenceTimerHabit(habitPhase: "reduction" | "abstinence"): boolean {
  return habitPhase === "abstinence";
}

function addDays(date: string, delta: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
}

function previousDay(date: string): string {
  return addDays(date, -1);
}

function statusForDate(records: DayCheckin[], date: string): CheckinStatus | "pending" | null {
  const match = records.find((record) => record.date === date);
  return match?.status ?? null;
}

function resolveStreakStatus(
  records: DayCheckin[],
  date: string,
  today: string,
  habitType?: "target" | "limit" | "abstinence",
  habitPhase: "reduction" | "abstinence" = "reduction",
): CheckinStatus | "pending" | null {
  const explicit = statusForDate(records, date);

  if (explicit !== null) {
    return explicit;
  }

  // Abstinence without relapse: closed days are success (worker writes this at 23:59).
  if (usesAbstinenceStreakRules(habitType ?? "target", habitPhase) && date < today) {
    return "success";
  }

  return null;
}

function hasFailedToday(records: DayCheckin[], today: string): boolean {
  return statusForDate(records, today) === "fail";
}

function isGlobalStreakDayComplete(
  recordsByHabit: Map<string, DayCheckin[]>,
  habits: HabitStreakScope[],
  date: string,
  today: string,
): boolean {
  const activeHabits = habits.filter((habit) => date >= habit.activeFrom);

  if (activeHabits.length === 0) {
    return false;
  }

  for (const habit of activeHabits) {
    const status = resolveStreakStatus(
      recordsByHabit.get(habit.id) ?? [],
      date,
      today,
      habit.type,
      habit.phase,
    );

    if (status === null || status === "fail" || status === "pending") {
      return false;
    }

    if (!STREAK_CONTINUE.has(status)) {
      return false;
    }
  }

  return true;
}

export function computeHabitStreak(
  records: DayCheckin[],
  today: string,
  activeFrom?: string,
  habitType?: "target" | "limit" | "abstinence",
  habitPhase: "reduction" | "abstinence" = "reduction",
): number {
  if (hasFailedToday(records, today)) {
    return 0;
  }

  let streak = 0;
  let cursor = previousDay(today);

  while (true) {
    if (activeFrom && cursor < activeFrom) {
      break;
    }

    const status = resolveStreakStatus(records, cursor, today, habitType, habitPhase);

    if (status === null || !STREAK_CONTINUE.has(status)) {
      break;
    }

    streak += 1;
    cursor = previousDay(cursor);
  }

  return streak;
}

export type HabitStreakScope = {
  id: string;
  /** First local calendar date this habit counts toward global streak. */
  activeFrom: string;
  type: "target" | "limit" | "abstinence";
  phase: "reduction" | "abstinence";
};

export function computeGlobalStreak(
  recordsByHabit: Map<string, DayCheckin[]>,
  habits: HabitStreakScope[],
  today: string,
): number {
  if (habits.length === 0) {
    return 0;
  }

  for (const habit of habits) {
    if (hasFailedToday(recordsByHabit.get(habit.id) ?? [], today)) {
      return 0;
    }
  }

  let streak = 0;
  let cursor = today;

  while (true) {
    const activeHabits = habits.filter((habit) => cursor >= habit.activeFrom);

    if (activeHabits.length === 0) {
      break;
    }

    if (!isGlobalStreakDayComplete(recordsByHabit, habits, cursor, today)) {
      if (cursor === today) {
        cursor = previousDay(today);
        continue;
      }

      break;
    }

    streak += 1;
    cursor = previousDay(cursor);
  }

  return streak;
}

export function getWeekStartMonday(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  const weekday = parsed.getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(date, -daysFromMonday);
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}
