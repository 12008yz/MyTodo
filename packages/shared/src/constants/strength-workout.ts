export type StrengthWorkoutExercise = {
  id: string;
  name: string;
  description: string;
  /** Local demo media path (bundled in /public/exercises). */
  demoGifUrl: string;
};

/** Bump when replacing files under /public/exercises/ (also update sw.js cache name). */
export const EXERCISE_MEDIA_CACHE_VERSION = 6;

/** All bundled exercise demo files under /public/exercises/. */
export const EXERCISE_MEDIA_PATHS = [
  "/exercises/squat.mp4",
  "/exercises/pushups.mp4",
  "/exercises/lunges.mp4",
  "/exercises/pullups.mp4",
  "/exercises/plank.mp4",
  "/exercises/warmup.mp4",
] as const;

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

/** Check-in value after marking one exercise done (full round completes the daily goal). */
export function strengthCheckinValueAfterExercise(
  currentValue: number,
  dailyGoalMinutes: number,
  roundComplete: boolean,
): number {
  const nextValue = currentValue + STRENGTH_WORKOUT_MINUTES_PER_REP;
  if (roundComplete) {
    return Math.max(dailyGoalMinutes, nextValue);
  }
  return nextValue;
}

/** Completed exercises in the current circuit round (0–STRENGTH_WORKOUT_REPS_PER_ROUND). */
export function strengthCircuitExercisesDone(
  repCounts: Readonly<Record<string, number>>,
  repsPerExercise: number,
): number {
  return STRENGTH_WORKOUT_EXERCISES.filter(
    (exercise) => (repCounts[exercise.id] ?? 0) >= repsPerExercise,
  ).length;
}

/** Progress toward today's circuit goal, as a 0–100 percentage. */
export function strengthCircuitProgressPercent(
  repCounts: Readonly<Record<string, number>>,
  repsPerExercise: number,
): number {
  const completed = strengthCircuitExercisesDone(repCounts, repsPerExercise);
  return Math.min(100, (completed / STRENGTH_WORKOUT_REPS_PER_ROUND) * 100);
}

/** Progression level stored in habit baseline_value (0 = start). */
export function resolveStrengthProgressionLevel(
  baselineValue: number,
  currentGoalMinutes?: number,
): number {
  if (!Number.isFinite(baselineValue)) {
    return 0;
  }

  // Legacy: baseline 4 meant level 0 (four-minute beginner) or progression level 4.
  if (baselineValue === STRENGTH_WORKOUT_BASE_MINUTES) {
    if (currentGoalMinutes != null && currentGoalMinutes > STRENGTH_WORKOUT_BASE_MINUTES) {
      return STRENGTH_WORKOUT_BASE_MINUTES;
    }
    if (
      currentGoalMinutes != null &&
      strengthDailyGoalMinutes(strengthProgressionLevelFromReps(baselineValue)) ===
        currentGoalMinutes
    ) {
      return strengthProgressionLevelFromReps(baselineValue);
    }
    return 0;
  }

  // Low rep counts stored directly (legacy) — e.g. baseline 3 with goal 3.
  if (
    baselineValue > 0 &&
    baselineValue < STRENGTH_WORKOUT_INITIAL_REPS &&
    currentGoalMinutes === baselineValue
  ) {
    return strengthProgressionLevelFromReps(baselineValue);
  }

  // High rep counts stored directly (legacy) — e.g. baseline 15 means 15 reps, not level 15.
  if (baselineValue >= STRENGTH_WORKOUT_INITIAL_REPS) {
    const levelFromReps = strengthProgressionLevelFromReps(baselineValue);
    if (levelFromReps < baselineValue) {
      const goalForRepsLevel = strengthDailyGoalMinutes(levelFromReps);
      const looksLikeRawOnboardingReps =
        currentGoalMinutes === baselineValue ||
        currentGoalMinutes === goalForRepsLevel;

      if (looksLikeRawOnboardingReps) {
        return levelFromReps;
      }
    }
  }

  return Math.floor(baselineValue);
}

export function strengthRepsPerExercise(level: number): number {
  return Math.max(1, STRENGTH_WORKOUT_INITIAL_REPS + level);
}

export function strengthDailyGoalMinutes(level: number): number {
  const minutes =
    STRENGTH_WORKOUT_BASE_MINUTES +
    Math.floor(level / STRENGTH_WORKOUT_REPS_BEFORE_MINUTE_BUMP);
  return Math.max(1, minutes);
}

/** Maps reps per exercise (onboarding input) to stored progression level. */
export function strengthProgressionLevelFromReps(reps: number): number {
  if (!Number.isFinite(reps) || reps <= 0) {
    return 0;
  }
  return Math.floor(reps) - STRENGTH_WORKOUT_INITIAL_REPS;
}

/** Converts onboarding baseline (reps) to progression level. */
export function strengthProgressionLevelFromOnboardingBaseline(baselineValue: number): number {
  if (!Number.isFinite(baselineValue) || baselineValue < 0) {
    return 0;
  }
  if (baselineValue === 0) {
    return 0;
  }
  return strengthProgressionLevelFromReps(baselineValue);
}

/** Short copy for onboarding — lists circuit exercises. */
export function formatStrengthWorkoutOnboardingDescription(): string {
  const names = STRENGTH_WORKOUT_EXERCISES.map((item) => item.name.toLowerCase());
  const last = names.at(-1);
  if (!last || names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return `В круге: ${last}.`;
  }
  return `В круге: ${names.slice(0, -1).join(", ")} и ${last}.`;
}

/** Cache-busted URL for exercise demo media (bump EXERCISE_MEDIA_CACHE_VERSION when files change). */
export function exerciseDemoUrl(path: string): string {
  return `${path}?v=${EXERCISE_MEDIA_CACHE_VERSION}`;
}

export function isExerciseDemoVideo(url: string): boolean {
  return url.split("?")[0]?.endsWith(".mp4") ?? false;
}

export const PLANK_DEMO_URL = exerciseDemoUrl("/exercises/plank.mp4");

export const WARMUP_DEMO_URL = exerciseDemoUrl("/exercises/warmup.mp4");

export function listExerciseDemoUrls(): readonly string[] {
  return EXERCISE_MEDIA_PATHS.map((path) => exerciseDemoUrl(path));
}

/** Bodyweight circuit — four exercises per round. */
export const STRENGTH_WORKOUT_EXERCISES: readonly StrengthWorkoutExercise[] = [
  {
    id: "squats",
    name: "Приседания",
    description: "Король всех упражнений. Качает ноги и ягодицы.",
    demoGifUrl: exerciseDemoUrl("/exercises/squat.mp4"),
  },
  {
    id: "pushups",
    name: "Отжимания",
    description: "Классика для груди, плеч и трицепсов.",
    demoGifUrl: exerciseDemoUrl("/exercises/pushups.mp4"),
  },
  {
    id: "lunges",
    name: "Выпады",
    description: "Для баланса и силы ног.",
    demoGifUrl: exerciseDemoUrl("/exercises/lunges.mp4"),
  },
  {
    id: "pullups",
    name: "Подтягивания",
    description: "Спина, бицепсы и хват — баланс к отжиманиям.",
    demoGifUrl: exerciseDemoUrl("/exercises/pullups.mp4"),
  },
] as const;
