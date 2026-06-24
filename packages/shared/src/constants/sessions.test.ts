import { describe, expect, it } from "vitest";
import {
  MIN_MINUTES_PER_LIGHT_HABIT,
  maxLightHabitsForBudget,
} from "./sessions.js";

describe("maxLightHabitsForBudget", () => {
  it("returns floor of free time divided by minimum per habit", () => {
    expect(maxLightHabitsForBudget(15)).toBe(1);
    expect(maxLightHabitsForBudget(30)).toBe(3);
    expect(maxLightHabitsForBudget(60)).toBe(6);
  });
});
