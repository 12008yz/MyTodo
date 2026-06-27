import { describe, expect, it } from "vitest";
import type { HabitReadingProgress } from "@mytodo/shared";
import { computeEffectivePagesRead } from "./bookSelection";

const baseReading: HabitReadingProgress = {
  book_id: "meditations",
  pages_read: 10,
  pages_credited_today: 5,
  last_read_page: 12,
  last_checkin_date: "2026-06-24",
  completed_at: null,
  page_count: 176,
};

describe("computeEffectivePagesRead", () => {
  it("adds only new checkin pages on the same day", () => {
    expect(computeEffectivePagesRead(baseReading, "2026-06-24", 8, 0)).toBe(13);
  });

  it("resets daily credit on a new day", () => {
    expect(computeEffectivePagesRead(baseReading, "2026-06-25", 3, 0)).toBe(13);
  });

  it("includes live session pages before checkin is saved", () => {
    expect(computeEffectivePagesRead(baseReading, "2026-06-24", 5, 2)).toBe(12);
  });

  it("counts today checkin before first daily credit is stored", () => {
    const firstSelect: HabitReadingProgress = {
      book_id: "meditations",
      pages_read: 0,
      pages_credited_today: 0,
      last_read_page: 1,
      last_checkin_date: null,
      completed_at: null,
      page_count: 176,
    };
    expect(computeEffectivePagesRead(firstSelect, "2026-06-24", 5, 0)).toBe(5);
  });
});
