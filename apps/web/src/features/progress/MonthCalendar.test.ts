import { describe, expect, it } from "vitest";
import type { DayColorValue } from "@mytodo/shared";
import {
  countCalendarWeekRows,
  formatMonthParam,
  shiftMonth,
} from "./MonthCalendar";

function daysForMonth(month: string, length: number): Array<{ date: string; color: DayColorValue }> {
  return Array.from({ length }, (_, index) => ({
    date: `${month}-${String(index + 1).padStart(2, "0")}`,
    color: "pending" as const,
  }));
}

describe("MonthCalendar grid size", () => {
  it("uses natural week row counts for different months", () => {
    const october2026 = "2026-10";
    const november2026 = "2026-11";

    expect(countCalendarWeekRows(october2026, daysForMonth(october2026, 31))).toBe(5);
    expect(countCalendarWeekRows(november2026, daysForMonth(november2026, 30))).toBe(6);
  });

  it("shifts months in YYYY-MM format", () => {
    expect(shiftMonth("2026-10", 1)).toBe("2026-11");
    expect(formatMonthParam(new Date(2026, 9, 1))).toBe("2026-10");
  });
});
