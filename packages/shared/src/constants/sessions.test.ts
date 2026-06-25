import { describe, expect, it } from "vitest";
import { maxLightHabitsForBudget } from "./sessions.js";

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
