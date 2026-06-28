import { describe, expect, it } from "vitest";
import {
  maxLightHabitsForBudget,
  PLANK_PREP_SECONDS,
  STRETCH_MIN_MINUTES,
  STRETCH_TARGET_MINUTES,
  computeSessionCompletionMinutes,
  sessionTotalSeconds,
} from "./sessions.js";

describe("maxLightHabitsForBudget", () => {
  it("allows all light habit slots when free time meets minimum", () => {
    expect(maxLightHabitsForBudget(15)).toBe(20);
    expect(maxLightHabitsForBudget(60)).toBe(20);
    expect(maxLightHabitsForBudget(120)).toBe(20);
  });

  it("returns zero when free time is below minimum", () => {
    expect(maxLightHabitsForBudget(5)).toBe(0);
  });
});

describe("sessionTotalSeconds", () => {
  it("uses planned_seconds when set on API-shaped session", () => {
    expect(sessionTotalSeconds({ planned_min: 1, planned_seconds: 35 })).toBe(35);
  });

  it("uses plannedSeconds from database-shaped session", () => {
    expect(sessionTotalSeconds({ plannedMin: 1, plannedSeconds: 35 })).toBe(35);
  });

  it("falls back to planned minutes", () => {
    expect(sessionTotalSeconds({ planned_min: 12 })).toBe(720);
  });
});

describe("PLANK_PREP_SECONDS", () => {
  it("gives a short fixed countdown before the exercise timer", () => {
    expect(PLANK_PREP_SECONDS).toBe(3);
  });
});

describe("STRETCH_TARGET_MINUTES", () => {
  it("targets five minutes of warm-up per day", () => {
    expect(STRETCH_MIN_MINUTES).toBe(5);
    expect(STRETCH_TARGET_MINUTES).toBe(5);
  });
});

describe("computeSessionCompletionMinutes", () => {
  it("credits planned block when timer finishes slightly over one minute", () => {
    expect(computeSessionCompletionMinutes(65_000, 1, null, false)).toBe(1);
  });

  it("rounds up partial minutes when session ends before planned duration", () => {
    expect(computeSessionCompletionMinutes(9.5 * 60_000, 10, null, false)).toBe(10);
  });

  it("returns planned minutes for early completion", () => {
    expect(computeSessionCompletionMinutes(30_000, 10, null, true)).toBe(10);
  });
});
