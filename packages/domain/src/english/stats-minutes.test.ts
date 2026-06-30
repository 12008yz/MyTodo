import { describe, expect, it } from "vitest";
import {
  sumEnglishWatchSecondsToMinutes,
  sumMinutesHabitValueForTodayStats,
} from "./stats-minutes.js";

describe("sumEnglishWatchSecondsToMinutes", () => {
  it("converts watched seconds to rounded-up minutes", () => {
    expect(sumEnglishWatchSecondsToMinutes([61, 120])).toBe(4);
  });
});

describe("sumMinutesHabitValueForTodayStats", () => {
  it("sums timer and video minutes for foreign language", () => {
    expect(
      sumMinutesHabitValueForTodayStats(
        { unit: "minutes", category_key: "language" },
        25,
        23,
      ),
    ).toBe(48);
  });

  it("uses timer minutes only for other minute habits", () => {
    expect(
      sumMinutesHabitValueForTodayStats(
        { unit: "minutes", category_key: "meditation" },
        15,
        23,
      ),
    ).toBe(15);
  });
});
