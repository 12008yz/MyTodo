import { describe, expect, it } from "vitest";
import { isBookDailyGoalComplete, pagesReadTodayInBook } from "./bookReadingProgress";

describe("bookReadingProgress", () => {
  it("counts pages from day start toward daily goal", () => {
    expect(pagesReadTodayInBook(1, 1, 5)).toBe(0);
    expect(pagesReadTodayInBook(5, 1, 5)).toBe(5);
    expect(pagesReadTodayInBook(8, 1, 5)).toBe(5);
    expect(pagesReadTodayInBook(15, 1, 15)).toBe(15);
    expect(pagesReadTodayInBook(14, 1, 15)).toBe(14);
  });

  it("continues from bookmark when day starts mid-book", () => {
    expect(pagesReadTodayInBook(14, 10, 5)).toBe(5);
    expect(pagesReadTodayInBook(13, 10, 5)).toBe(4);
    expect(isBookDailyGoalComplete(14, 10, 5)).toBe(true);
  });
});
