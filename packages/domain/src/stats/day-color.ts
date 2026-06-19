export type HabitDayStatus = "success" | "fail" | "skipped" | "pending";

export type DayColor = "success" | "pending" | "fail" | "skipped";

/**
 * Aggregates per-habit statuses into a single day color (§10.2).
 * English and other modules outside the habit list are excluded by the caller.
 */
export function computeDayColor(statuses: HabitDayStatus[]): DayColor {
  if (statuses.length === 0) {
    return "pending";
  }

  if (statuses.some((status) => status === "fail")) {
    return "fail";
  }

  if (statuses.some((status) => status === "pending")) {
    return "pending";
  }

  if (statuses.every((status) => status === "success")) {
    return "success";
  }

  return "skipped";
}

export function addDays(date: string, delta: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
}

export function listDatesInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function getMonthRange(month: string): { start: string; end: string } {
  const [year, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const monthPart = String(monthNum).padStart(2, "0");

  return {
    start: `${year}-${monthPart}-01`,
    end: `${year}-${monthPart}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function getProgressPeriodRange(
  today: string,
  period: "week" | "month" | "quarter",
): { start: string; end: string } {
  if (period === "week") {
    return { start: addDays(today, -6), end: today };
  }

  if (period === "month") {
    return { start: addDays(today, -29), end: today };
  }

  return { start: addDays(today, -89), end: today };
}
