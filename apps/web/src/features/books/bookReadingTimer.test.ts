import { describe, expect, it } from "vitest";
import {
  booksPagesRemainingForToday,
  formatBooksDailyProgressLabel,
} from "./bookReadingTimer";

describe("bookReadingTimer", () => {
  it("computes remaining pages for today's plan without capping read total", () => {
    expect(booksPagesRemainingForToday(3, 5)).toBe(2);
    expect(booksPagesRemainingForToday(5, 5)).toBe(0);
    expect(booksPagesRemainingForToday(8, 5)).toBe(0);
  });

  it("formats daily progress below, at, and above plan", () => {
    expect(formatBooksDailyProgressLabel(3, 5)).toBe("3/5 стр.");
    expect(formatBooksDailyProgressLabel(5, 5)).toBe("5/5 стр.");
    expect(formatBooksDailyProgressLabel(8, 5)).toBe("8 стр. (план 5)");
  });
});
