import { MAX_ACTIVE_HABITS } from "./habits.js";

export const MIN_MINUTES_PER_LIGHT_HABIT = 10;
export const MAX_LIGHT_HABITS = 20;
export const SESSION_MIN_MIN = 10;
export const SESSION_MAX_MIN = 15;
export const SESSION_TARGET_MIN = 12;
export const AWARENESS_SESSION_MIN = 5;
export const LESSON_MINUTES_ESTIMATE = 15;
export const DOOM_SCROLL_DURATION_MIN = 15;

/** One focus block per day for meditation — goal grows via check-ins / progression. */
export const MEDITATION_SESSION_MIN = 1;
export const MEDITATION_DAILY_GOAL_MIN = 1;
export const MEDITATION_HABIT_NAME = "Медитация";

/** Beginner reading: 5 pages per day. */
export const BOOKS_START_PAGES = 5;

/** Foreign-language practice — fixed ~25 min block. */
export const LANGUAGE_SESSION_MIN = 25;
export const LANGUAGE_SESSION_MAX = 25;
export const LANGUAGE_SESSION_TARGET_MIN = 25;
export const FOREIGN_LANGUAGE_HABIT_NAME = "Иностранный язык";

/** Running — always at least 10 min per day. */
export const RUNNING_MIN_MINUTES = 10;

/** Plank — starts at 20 seconds. */
export const PLANK_START_SECONDS = 20;

/** Countdown before plank timer starts — time to get into position. */
export const PLANK_PREP_SECONDS = 3;

/** Stretching — 1–2 min per day (target 2). */
export const STRETCH_MIN_MINUTES = 1;
export const STRETCH_TARGET_MINUTES = 2;

/** Bodyweight circuit — 4 exercises, 1 set each (~5 min). */
export const STRENGTH_WORKOUT_TARGET_MINUTES = 5;

/** Outdoor walk — starts from 10 min. */
export const WALKING_MIN_MINUTES = 10;

/** Gratitude journal — fixed 2 min. */
export const GRATITUDE_DAILY_MIN = 2;

/** Custom creator / generic light habits — about 20 min per day. */
export const CUSTOM_LIGHT_TARGET_MINUTES = 20;
export const CREATIVE_PROJECT_TARGET_MINUTES = 20;
export const PROGRAMMING_TARGET_MINUTES = 20;

/** Meal planning from what's in the fridge — no timed session until recipe flow ships. */
export const NUTRITION_HABIT_NAME = "Правильное питание";

/** Early rise — shift wake time earlier, not a timed session. */
export const EARLY_RISE_SHIFT_MIN = 5;
export const EARLY_RISE_HABIT_NAME = "Ранний подъём";

export function maxLightHabitsForBudget(freeTimeMin: number): number {
  if (freeTimeMin < MIN_MINUTES_PER_LIGHT_HABIT) return 0;
  return Math.min(MAX_LIGHT_HABITS, MAX_ACTIVE_HABITS);
}

export function sessionBudgetMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

export function sessionTotalSeconds(session: {
  planned_min?: number;
  planned_seconds?: number | null;
  plannedMin?: number;
  plannedSeconds?: number | null;
}): number {
  const plannedSeconds = session.planned_seconds ?? session.plannedSeconds ?? null;
  if (plannedSeconds != null && plannedSeconds > 0) {
    return plannedSeconds;
  }

  const plannedMin = session.planned_min ?? session.plannedMin ?? 0;
  return Math.max(1, plannedMin * 60);
}
