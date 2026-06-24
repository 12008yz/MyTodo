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

/** Beginner reading: 5 pages per day, one ~10 min session in the daily plan. */
export const BOOKS_START_PAGES = 5;
export const BOOKS_SESSION_MIN = 10;

/** Foreign-language practice block length (minutes). */
export const LANGUAGE_SESSION_MIN = 20;
export const LANGUAGE_SESSION_MAX = 25;
export const LANGUAGE_SESSION_TARGET_MIN = 20;
export const FOREIGN_LANGUAGE_HABIT_NAME = "Иностранный язык";

export function maxLightHabitsForBudget(freeTimeMin: number): number {
  if (freeTimeMin < MIN_MINUTES_PER_LIGHT_HABIT) return 0;
  return Math.min(MAX_LIGHT_HABITS, MAX_ACTIVE_HABITS);
}
