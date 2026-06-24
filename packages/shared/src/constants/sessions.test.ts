import { describe, expect, it } from "vitest";
import { maxLightHabitsForBudget } from "./sessions.js";

describe("maxLightHabitsForBudget", () => {
  it("returns zero when free time is below the minimum per habit", () => {
    expect(maxLightHabitsForBudget(0)).toBe(0);
    expect(maxLightHabitsForBudget(9)).toBe(0);
  });

  it("allows all catalog activities regardless of free time", () => {
    expect(maxLightHabitsForBudget(15)).toBe(20);
    expect(maxLightHabitsForBudget(60)).toBe(20);
    expect(maxLightHabitsForBudget(120)).toBe(20);
  });
});
