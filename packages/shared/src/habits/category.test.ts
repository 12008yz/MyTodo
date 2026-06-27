import { describe, expect, it } from "vitest";
import {
  isEarlyRiseCategoryKey,
  isNonSessionLightCategory,
  isNutritionCategoryKey,
  isStrengthWorkoutCategoryKey,
  isStrengthWorkoutHabit,
} from "./category.js";

describe("habit category helpers", () => {
  it("detects early rise and nutrition categories", () => {
    expect(isEarlyRiseCategoryKey("early_rise")).toBe(true);
    expect(isNutritionCategoryKey("healthy_nutrition")).toBe(true);
    expect(isEarlyRiseCategoryKey("meditation")).toBe(false);
  });

  it("groups non-session light categories", () => {
    expect(isNonSessionLightCategory("early_rise")).toBe(true);
    expect(isNonSessionLightCategory("healthy_nutrition")).toBe(true);
    expect(isNonSessionLightCategory("meditation")).toBe(false);
    expect(isNonSessionLightCategory(null)).toBe(false);
  });

  it("detects strength workout category", () => {
    expect(isStrengthWorkoutCategoryKey("strength_workout")).toBe(true);
    expect(isStrengthWorkoutCategoryKey("stretching")).toBe(false);
    expect(isNonSessionLightCategory("strength_workout")).toBe(false);
    expect(isStrengthWorkoutHabit({ category_key: "strength_workout" })).toBe(true);
    expect(isStrengthWorkoutHabit({ name: "Силовая тренировка" })).toBe(true);
    expect(isStrengthWorkoutHabit({ name: "Бег", category_key: "walking" })).toBe(false);
  });
});
