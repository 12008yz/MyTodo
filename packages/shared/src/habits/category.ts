import type { HabitCategoryKey } from "../constants/habits.js";
import {
  FOREIGN_LANGUAGE_HABIT_NAME,
  MEDITATION_HABIT_NAME,
  NUTRITION_HABIT_NAME,
} from "../constants/sessions.js";

type HabitCategoryRef = {
  category_key?: HabitCategoryKey | string | null;
  name?: string | null;
};

export function isEarlyRiseCategoryKey(
  categoryKey: HabitCategoryKey | string | null | undefined,
): boolean {
  return categoryKey === "early_rise";
}

export function isNutritionCategoryKey(
  categoryKey: HabitCategoryKey | string | null | undefined,
): boolean {
  return categoryKey === "healthy_nutrition";
}

export function isNutritionHabit(habit: HabitCategoryRef): boolean {
  return (
    isNutritionCategoryKey(habit.category_key) ||
    habit.name?.trim() === NUTRITION_HABIT_NAME
  );
}

export function isMeditationHabit(habit: HabitCategoryRef): boolean {
  return habit.category_key === "meditation" || habit.name?.trim() === MEDITATION_HABIT_NAME;
}

export function isForeignLanguageHabit(habit: HabitCategoryRef): boolean {
  return (
    habit.category_key === "language" ||
    habit.name?.trim() === FOREIGN_LANGUAGE_HABIT_NAME
  );
}

/** Light habits that provide utility without daily check-in / day-close. */
export function isCompanionLightHabit(habit: HabitCategoryRef): boolean {
  return isNutritionHabit(habit);
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

export function isWarmupHabit(habit: {
  category_key?: HabitCategoryKey | null;
  name?: string | null;
}): boolean {
  const name = habit.name?.trim();
  return (
    habit.category_key === "stretching" ||
    name === "Разминка" ||
    name === "Растяжка"
  );
}

/** Habits without pomodoro sessions or minute progress bars on Today. */
export function isNonSessionLightCategory(
  categoryKey: HabitCategoryKey | null | undefined,
): boolean {
  return isEarlyRiseCategoryKey(categoryKey) || isNutritionCategoryKey(categoryKey);
}
