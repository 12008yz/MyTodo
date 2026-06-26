import { describe, expect, it } from "vitest";
import { maxLightHabitsForBudget, sessionTotalSeconds } from "./sessions.js";

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
