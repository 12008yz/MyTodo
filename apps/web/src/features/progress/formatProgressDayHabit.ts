import type { StatsCalendarResponse } from "@mytodo/shared";
import { usesAbstinenceStreakRules } from "@mytodo/domain";
import { formatUnit } from "../today/format";

export type ProgressCalendarHabit = StatsCalendarResponse["days"][number]["habits"][number];

function isAbstinenceHabit(habit: ProgressCalendarHabit): boolean {
  return usesAbstinenceStreakRules(habit.type, habit.phase);
}

function formatValueGoal(value: number, goal: number, unit: ProgressCalendarHabit["unit"]): string {
  const unitLabel = formatUnit(unit);
  return unitLabel ? `${value} / ${goal} ${unitLabel}` : `${value} / ${goal}`;
}

function formatAbstinenceDetail(status: ProgressCalendarHabit["status"]): string {
  switch (status) {
    case "success":
      return "День без срыва";
    case "fail":
      return "Сорвался";
    case "skipped":
      return "Пропуск";
    default:
      return "День ещё идёт";
  }
}

function formatSocialMediaDetail(habit: ProgressCalendarHabit): string | null {
  const consumed = habit.minutes_total > 0 ? habit.minutes_total : habit.value;
  if (habit.goal == null) {
    return consumed != null && consumed > 0 ? `${consumed} мин` : null;
  }
  if (consumed != null) {
    return `${consumed} / ${habit.goal} мин`;
  }
  if (habit.status === "pending") {
    return "День ещё идёт";
  }
  return `лимит ${habit.goal} мин`;
}

export function formatProgressDayHabitDetail(habit: ProgressCalendarHabit): string | null {
  if (isAbstinenceHabit(habit)) {
    return formatAbstinenceDetail(habit.status);
  }

  if (habit.template_id === "social_media") {
    return formatSocialMediaDetail(habit);
  }

  if (habit.type === "limit" || habit.type === "target") {
    if (habit.value != null && habit.goal != null) {
      return formatValueGoal(habit.value, habit.goal, habit.unit);
    }
    if (habit.goal != null && habit.type === "limit") {
      return habit.status === "pending" ? `лимит ≤ ${habit.goal} ${formatUnit(habit.unit)}`.trim() : null;
    }
  }

  return null;
}

export function progressDayStatusSymbol(status: ProgressCalendarHabit["status"]): string {
  switch (status) {
    case "success":
      return "✓";
    case "fail":
      return "✗";
    case "skipped":
      return "—";
    default:
      return "…";
  }
}
