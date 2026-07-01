import type { StatsCalendarResponse, StatsSide } from "@mytodo/shared";

type CalendarHabit = StatsCalendarResponse["days"][number]["habits"][number];
export type HabitChartUnit = CalendarHabit["unit"] | "days" | null;

function positiveNumber(value: number | null | undefined): number {
  if (value == null || value <= 0) {
    return 0;
  }
  return value;
}

function resolveMinutesMetric(habit: CalendarHabit): number {
  if (habit.minutes_total > 0) {
    return habit.minutes_total;
  }
  return positiveNumber(habit.value);
}

function resolveLightMetric(habit: CalendarHabit): number {
  if (habit.unit === "minutes") {
    return resolveMinutesMetric(habit);
  }

  const value = positiveNumber(habit.value);
  if (value > 0) {
    return value;
  }

  return positiveNumber(habit.minutes_total);
}

export function habitChartMetric(habit: CalendarHabit, side: StatsSide): number {
  if (side === "light") {
    return resolveLightMetric(habit);
  }

  if (habit.type === "abstinence") {
    return habit.status === "success" ? 1 : 0;
  }

  if (habit.type === "limit") {
    const value = positiveNumber(habit.value);
    if (value > 0) {
      return value;
    }
    return positiveNumber(habit.minutes_total);
  }

  return resolveMinutesMetric(habit);
}

export function habitChartUnit(habit: CalendarHabit, side: StatsSide): HabitChartUnit {
  if (side === "light") {
    return habit.unit ?? "minutes";
  }

  if (habit.type === "abstinence") {
    return "days";
  }

  return habit.unit;
}

export function mergeHabitChartUnit(current: HabitChartUnit, next: HabitChartUnit): HabitChartUnit {
  if (current == null) {
    return next;
  }
  if (next == null || current === next) {
    return current;
  }
  return null;
}

export function shouldIncludeHabit(habit: CalendarHabit, side: StatsSide): boolean {
  if (habit.side !== side) {
    return false;
  }

  if (side === "dark" && habit.type === "target") {
    return false;
  }

  return true;
}
