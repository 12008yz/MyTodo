import { MAX_ACTIVE_HABITS } from "./habits.js";

export const MIN_MINUTES_PER_LIGHT_HABIT = 10;
export const SESSION_MIN_MIN = 10;
export const SESSION_MAX_MIN = 15;
export const SESSION_TARGET_MIN = 12;
export const AWARENESS_SESSION_MIN = 5;
export const LESSON_MINUTES_ESTIMATE = 15;
export const DOOM_SCROLL_DURATION_MIN = 15;

export function maxLightHabitsForBudget(freeTimeMin: number): number {
  if (freeTimeMin < MIN_MINUTES_PER_LIGHT_HABIT) return 0;
  return Math.min(
    MAX_ACTIVE_HABITS,
    Math.floor(freeTimeMin / MIN_MINUTES_PER_LIGHT_HABIT),
  );
}
