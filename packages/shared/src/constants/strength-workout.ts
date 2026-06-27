export type StrengthWorkoutExercise = {
  id: string;
  name: string;
  description: string;
  /** Local demo media path (bundled in /public/exercises). */
  demoGifUrl: string;
};

/** Bump when replacing files under /public/exercises/ (also update sw.js cache name). */
export const EXERCISE_MEDIA_CACHE_VERSION = 3;

/** Minutes credited when an exercise is marked done (one «Сделал» = all reps). */
export const STRENGTH_WORKOUT_MINUTES_PER_REP = 1;

/** Starting reps per exercise at progression level 0. */
export const STRENGTH_WORKOUT_INITIAL_REPS = 5;

/** @deprecated Use strengthRepsPerExercise(level). */
export const STRENGTH_WORKOUT_REPS_PER_EXERCISE = STRENGTH_WORKOUT_INITIAL_REPS;

/** Daily minutes at progression level 0 (four exercises × one minute). */
export const STRENGTH_WORKOUT_BASE_MINUTES = 4;

/** Rep-level increases before daily minutes on the card go up by one. */
export const STRENGTH_WORKOUT_REPS_BEFORE_MINUTE_BUMP = 2;

/** Exercises per circuit round. */
export const STRENGTH_WORKOUT_REPS_PER_ROUND = 4;

/** Progression level stored in habit baseline_value (0 = start). */
export function resolveStrengthProgressionLevel(
  baselineValue: number,
  currentGoalMinutes?: number,
): number {
  if (!Number.isFinite(baselineValue) || baselineValue < 0) {
    return 0;
  }

  // Legacy onboarding stored daily minutes (4) at level 0. Level 4 also uses baseline 4,
  // but then current_goal is already above the starting four minutes.
  if (
    baselineValue === STRENGTH_WORKOUT_BASE_MINUTES &&
    currentGoalMinutes != null &&
    currentGoalMinutes > STRENGTH_WORKOUT_BASE_MINUTES
  ) {
    return STRENGTH_WORKOUT_BASE_MINUTES;
  }

  if (baselineValue === STRENGTH_WORKOUT_BASE_MINUTES) {
    return 0;
  }

  return Math.floor(baselineValue);
}

export function strengthRepsPerExercise(level: number): number {
  return STRENGTH_WORKOUT_INITIAL_REPS + Math.max(0, level);
}

export function strengthDailyGoalMinutes(level: number): number {
  const safeLevel = Math.max(0, level);
  return (
    STRENGTH_WORKOUT_BASE_MINUTES +
    Math.floor(safeLevel / STRENGTH_WORKOUT_REPS_BEFORE_MINUTE_BUMP)
  );
}

/** Bodyweight circuit — four exercises per round. */
export const STRENGTH_WORKOUT_EXERCISES: readonly StrengthWorkoutExercise[] = [
  {
    id: "squats",
    name: "Приседания",
    description: "Король всех упражнений. Качает ноги и ягодицы.",
    demoGifUrl: "/exercises/squat.mp4",
  },
  {
    id: "pushups",
    name: "Отжимания",
    description: "Классика для груди, плеч и трицепсов.",
    demoGifUrl: "/exercises/pushups.mp4",
  },
  {
    id: "lunges",
    name: "Выпады",
    description: "Для баланса и силы ног.",
    demoGifUrl: "/exercises/lunges.mp4",
  },
  {
    id: "pullups",
    name: "Подтягивания",
    description: "Спина, бицепсы и хват — баланс к отжиманиям.",
    demoGifUrl: "/exercises/pullups.mp4",
  },
] as const;
