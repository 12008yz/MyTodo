import { describe, expect, it } from "vitest";
import {
  bookPagesRemainingFromPosition,
  isBookDailyGoalComplete,
  pagesReadTodayFromProgress,
  pagesReadTodayInBook,
} from "./bookReadingProgress";

describe("bookReadingProgress", () => {
  it("counts pages from day start without capping at daily goal", () => {
    expect(pagesReadTodayInBook(1, 1)).toBe(0);
    expect(pagesReadTodayInBook(5, 1)).toBe(5);
    expect(pagesReadTodayInBook(8, 1)).toBe(8);
    expect(pagesReadTodayInBook(12, 1)).toBe(12);
    expect(pagesReadTodayInBook(15, 1)).toBe(15);
    expect(pagesReadTodayInBook(14, 1)).toBe(14);
  });

  it("continues from bookmark when day starts mid-book", () => {
    expect(pagesReadTodayInBook(10, 10)).toBe(0);
    expect(pagesReadTodayInBook(13, 10)).toBe(4);
    expect(pagesReadTodayInBook(14, 10)).toBe(5);
    expect(pagesReadTodayInBook(16, 10)).toBe(7);
    expect(isBookDailyGoalComplete(14, 10, 5)).toBe(true);
    expect(isBookDailyGoalComplete(13, 10, 5)).toBe(false);
  });

  it("reads today total from stored progress", () => {
    expect(
      pagesReadTodayFromProgress(
        {
          book_id: "meditations",
          pages_read: 20,
          pages_credited_today: 5,
          last_read_page: 25,
          reader_day_start_page: 20,
          reader_day_date: "2026-06-27",
          last_checkin_date: "2026-06-27",
          completed_at: null,
        },
        "2026-06-27",
      ),
    ).toBe(6);
  });

  it("falls back to credited pages when today's reader baseline is missing", () => {
    expect(
      pagesReadTodayFromProgress(
        {
          book_id: "meditations",
          pages_read: 20,
          pages_credited_today: 8,
          last_read_page: 25,
          reader_day_start_page: 20,
          reader_day_date: "2026-06-26",
          last_checkin_date: "2026-06-27",
          completed_at: null,
        },
        "2026-06-27",
      ),
    ).toBe(8);
  });

  it("estimates remaining pages from current position", () => {
    expect(bookPagesRemainingFromPosition(1, 176)).toBe(176);
    expect(bookPagesRemainingFromPosition(42, 176)).toBe(135);
    expect(bookPagesRemainingFromPosition(176, 176)).toBe(1);
    expect(bookPagesRemainingFromPosition(177, 176)).toBe(0);
  });
});
