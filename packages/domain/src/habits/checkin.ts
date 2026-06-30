import type { DayStatus } from "./progression.js";

export type CheckinStatus = "success" | "fail" | "skipped" | "pending";

export type HabitForCheckin = {
  type: "target" | "limit" | "abstinence";
  side: "light" | "dark";
  currentGoal: number;
  templateId?: string | null;
};

export type ResolveCheckinInput =
  | { value: number }
  | { status: "skipped" }
  | { status: "fail" };

function resolveLightTargetCheckinStatus(value: number, currentGoal: number): CheckinStatus {
  return value >= currentGoal ? "success" : "pending";
}

export function resolveForeignLanguageCheckinStatus(
  value: number,
  currentGoal: number,
): CheckinStatus {
  return value >= currentGoal ? "success" : "pending";
}

export function resolveCheckinStatus(
  habit: HabitForCheckin,
  input: ResolveCheckinInput,
): CheckinStatus {
  if ("status" in input && input.status === "skipped") {
    return "skipped";
  }

  if (habit.type === "abstinence") {
    return "fail";
  }

  if (!("value" in input)) {
    throw new Error("value is required for target and limit habits");
  }

  if (habit.type === "target") {
    if (habit.side === "light") {
      return resolveLightTargetCheckinStatus(input.value, habit.currentGoal);
    }

    return input.value >= habit.currentGoal ? "success" : "fail";
  }

  if (input.value > habit.currentGoal) {
    return "fail";
  }

  return "pending";
}

export function previewDayStatusForProgression(
  habit: HabitForCheckin,
  status: string | undefined,
  value: number | null | undefined,
): DayStatus {
  if (status === "success" || status === "fail" || status === "skipped") {
    return status;
  }

  if (status === "pending") {
    if (habit.type === "limit" && value != null && value <= habit.currentGoal) {
      return "success";
    }

    return "fail";
  }

  return "success";
}

function parseIsoDate(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m: m!, d: d! };
}

/** Day of week for a calendar date (0 = Sunday). */
function calendarDayOfWeek(dateStr: string): number {
  const { y, m, d } = parseIsoDate(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addCalendarDays(dateStr: string, days: number): string {
  const { y, m, d } = parseIsoDate(dateStr);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOfWeek(dateStr: string): string {
  const day = calendarDayOfWeek(dateStr);
  const diff = day === 0 ? -6 : 1 - day;
  return addCalendarDays(dateStr, diff);
}

function sundayOfWeek(dateStr: string): string {
  return addCalendarDays(mondayOfWeek(dateStr), 6);
}

export function countSkipsInWeek(skippedDates: string[], referenceDate: string): number {
  const weekStart = mondayOfWeek(referenceDate);
  const weekEnd = sundayOfWeek(referenceDate);

  return skippedDates.filter((date) => date >= weekStart && date <= weekEnd).length;
}

export function canSkipThisWeek(skippedDates: string[], referenceDate: string): boolean {
  return countSkipsInWeek(skippedDates, referenceDate) < 2;
}
