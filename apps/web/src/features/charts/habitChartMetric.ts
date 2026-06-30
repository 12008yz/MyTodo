import type { StatsCalendarResponse, StatsSide } from "@mytodo/shared";

type CalendarHabit = StatsCalendarResponse["days"][number]["habits"][number];
export type HabitChartUnit = CalendarHabit["unit"] | "days" | null;

export function habitChartMetric(habit: CalendarHabit, side: StatsSide): number {
  if (side === "light") {
    return habit.minutes_total;
  }

  if (habit.type === "abstinence") {
    return habit.status === "success" ? 1 : 0;
  }

  if (habit.type === "limit") {
    if (habit.value != null && habit.value > 0) {
      return habit.value;
    }
    return habit.minutes_total;
  }

  return habit.minutes_total > 0 ? habit.minutes_total : (habit.value ?? 0);
}

export function habitChartUnit(habit: CalendarHabit, side: StatsSide): HabitChartUnit {
  if (side === "light") {
    return "minutes";
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
