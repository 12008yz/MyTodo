import { describe, expect, it } from "vitest";
import {
  buildGeneralBookEstimate,
  buildHabitBookEstimate,
  estimateDaysAtHabitGoal,
  formatHabitBookReadingTime,
  formatHabitBookRemainingTime,
} from "./bookReadingPlan";

describe("bookReadingPlan", () => {
  it("estimates finish time with growing habit goal", () => {
    const days = estimateDaysAtHabitGoal({
      pageCount: 100,
      startPagesPerDay: 5,
      growthStep: 1,
      intervalDays: 3,
    });
    expect(days).toBe(15);
  });

  it("accounts for success days already at current goal", () => {
    const withProgress = estimateDaysAtHabitGoal({
      pageCount: 100,
      startPagesPerDay: 5,
      growthStep: 1,
      intervalDays: 3,
      successDaysAtGoal: 2,
    });
    const fromScratch = estimateDaysAtHabitGoal({
      pageCount: 100,
      startPagesPerDay: 5,
      growthStep: 1,
      intervalDays: 3,
      successDaysAtGoal: 0,
    });
    expect(withProgress).toBeLessThan(fromScratch);
  });

  it("formats full and remaining reading time", () => {
    const full = buildGeneralBookEstimate(592);
    expect(full.finishDays).toBe(48);
    expect(formatHabitBookReadingTime(full)).toBe("≈48 дней чтения");

    const remaining = buildHabitBookEstimate({
      pageCount: 200,
      currentGoal: 5,
      growthStep: 1,
      intervalDays: 3,
      successDaysAtGoal: 0,
    });
    expect(formatHabitBookRemainingTime(remaining)).toContain("осталось");
  });
});
