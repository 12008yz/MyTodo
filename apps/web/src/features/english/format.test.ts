import { describe, expect, it } from "vitest";
import { resolveEnglishHabitGoalMinutes } from "./format";

describe("resolveEnglishHabitGoalMinutes", () => {
  const goal = 25;
  const shortVideoSec = 23 * 60;
  const longVideoSec = 32 * 60;

  it("credits full goal when a shorter video is fully watched", () => {
    expect(
      resolveEnglishHabitGoalMinutes(shortVideoSec, shortVideoSec, goal, false),
    ).toBe(25);
  });

  it("shows partial minutes while a shorter video is in progress", () => {
    expect(
      resolveEnglishHabitGoalMinutes(15 * 60, shortVideoSec, goal, false),
    ).toBe(15);
  });

  it("credits full goal when lesson is marked complete", () => {
    expect(resolveEnglishHabitGoalMinutes(0, shortVideoSec, goal, true)).toBe(25);
  });

  it("shows capped minutes during a longer video until it ends", () => {
    expect(
      resolveEnglishHabitGoalMinutes(25 * 60, longVideoSec, goal, false),
    ).toBe(25);
    expect(
      resolveEnglishHabitGoalMinutes(24 * 60, longVideoSec, goal, false),
    ).toBe(24);
  });

  it("credits full goal only after a longer video is fully watched", () => {
    expect(
      resolveEnglishHabitGoalMinutes(longVideoSec, longVideoSec, goal, false),
    ).toBe(25);
  });
});
