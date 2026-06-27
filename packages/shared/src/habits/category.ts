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

export function isStrengthWorkoutCategoryKey(
  categoryKey: HabitCategoryKey | null | undefined,
): boolean {
  return categoryKey === "strength_workout";
}

export function isStrengthWorkoutHabit(habit: {
  category_key?: HabitCategoryKey | null;
  name?: string | null;
}): boolean {
  return (
    isStrengthWorkoutCategoryKey(habit.category_key) ||
    habit.name?.trim() === "Силовая тренировка"
  );
}

export function isPlankHabit(habit: {
  template_id?: string | null;
  name?: string | null;
}): boolean {
  return habit.template_id === "plank" || habit.name?.trim() === "Планка";
}

/** Habits without pomodoro sessions or minute progress bars on Today. */
export function isNonSessionLightCategory(
  categoryKey: HabitCategoryKey | null | undefined,
): boolean {
  return isEarlyRiseCategoryKey(categoryKey) || isNutritionCategoryKey(categoryKey);
}
