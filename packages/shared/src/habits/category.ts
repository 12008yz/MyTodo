import type { HabitCategoryKey } from "../constants/habits.js";

export function isEarlyRiseCategoryKey(
  categoryKey: HabitCategoryKey | null | undefined,
): boolean {
  return categoryKey === "early_rise";
}

export function isNutritionCategoryKey(
  categoryKey: HabitCategoryKey | null | undefined,
): boolean {
  return categoryKey === "healthy_nutrition";
}

/** Habits without pomodoro sessions or minute progress bars on Today. */
export function isNonSessionLightCategory(
  categoryKey: HabitCategoryKey | null | undefined,
): boolean {
  return isEarlyRiseCategoryKey(categoryKey) || isNutritionCategoryKey(categoryKey);
}
