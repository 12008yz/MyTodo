import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STRENGTH_WORKOUT_TARGET_MINUTES } from "./sessions.js";
import {
  EXERCISE_MEDIA_CACHE_VERSION,
  EXERCISE_MEDIA_PATHS,
  PLANK_DEMO_URL,
  STRENGTH_WORKOUT_BASE_MINUTES,
  STRENGTH_WORKOUT_EXERCISES,
  STRENGTH_WORKOUT_INITIAL_REPS,
  STRENGTH_WORKOUT_MINUTES_PER_REP,
  STRENGTH_WORKOUT_REPS_BEFORE_MINUTE_BUMP,
  STRENGTH_WORKOUT_REPS_PER_EXERCISE,
  STRENGTH_WORKOUT_REPS_PER_ROUND,
  exerciseDemoUrl,
  isExerciseDemoVideo,
  listExerciseDemoUrls,
  resolveStrengthProgressionLevel,
  strengthDailyGoalMinutes,
  strengthRepsPerExercise,
} from "./strength-workout.js";

describe("strength workout constants", () => {
  it("defines four bodyweight exercises in circuit order", () => {
    expect(STRENGTH_WORKOUT_EXERCISES).toHaveLength(4);
    expect(STRENGTH_WORKOUT_EXERCISES.map((item) => item.id)).toEqual([
      "squats",
      "pushups",
      "lunges",
      "pullups",
    ]);
    expect(STRENGTH_WORKOUT_EXERCISES.map((item) => item.demoGifUrl)).toEqual(
      EXERCISE_MEDIA_PATHS.filter((path) => path !== "/exercises/plank.mp4").map((path) =>
        exerciseDemoUrl(path),
      ),
    );
  });

  it("uses a versioned SW cache name (keep in sync with public/sw.js)", () => {
    expect(`mytodo-exercises-v${EXERCISE_MEDIA_CACHE_VERSION}`).toBe("mytodo-exercises-v5");
  });

  it("keeps public/sw.js in sync with EXERCISE_MEDIA_CACHE_VERSION", () => {
    const swPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../apps/web/public/sw.js",
    );
    const swSource = readFileSync(swPath, "utf8");
    const version = String(EXERCISE_MEDIA_CACHE_VERSION);

    expect(swSource).toContain(`mytodo-exercises-v${version}`);
    for (const path of EXERCISE_MEDIA_PATHS) {
      expect(swSource).toContain(`${path}?v=${version}`);
    }
  });

  it("detects mp4 demo URLs with cache-busting query params", () => {
    expect(isExerciseDemoVideo(exerciseDemoUrl("/exercises/squat.mp4"))).toBe(true);
    expect(isExerciseDemoVideo("/exercises/squat.gif")).toBe(false);
  });

  it("lists all bundled exercise demo URLs with cache version", () => {
    expect(listExerciseDemoUrls()).toEqual(
      EXERCISE_MEDIA_PATHS.map((path) => exerciseDemoUrl(path)),
    );
    expect(PLANK_DEMO_URL).toBe(exerciseDemoUrl("/exercises/plank.mp4"));
  });

  it("starts at five reps per exercise", () => {
    expect(STRENGTH_WORKOUT_INITIAL_REPS).toBe(5);
    expect(STRENGTH_WORKOUT_REPS_PER_EXERCISE).toBe(5);
    expect(strengthRepsPerExercise(0)).toBe(5);
  });

  it("credits one minute per completed exercise toward the daily goal", () => {
    expect(STRENGTH_WORKOUT_MINUTES_PER_REP).toBe(1);
    expect(STRENGTH_WORKOUT_REPS_PER_ROUND).toBe(4);
    expect(
      STRENGTH_WORKOUT_MINUTES_PER_REP * STRENGTH_WORKOUT_REPS_PER_ROUND,
    ).toBe(STRENGTH_WORKOUT_TARGET_MINUTES);
    expect(STRENGTH_WORKOUT_EXERCISES).toHaveLength(STRENGTH_WORKOUT_REPS_PER_ROUND);
  });

  it("targets one short circuit per round at level 0", () => {
    expect(STRENGTH_WORKOUT_BASE_MINUTES).toBe(4);
    expect(strengthDailyGoalMinutes(0)).toBe(STRENGTH_WORKOUT_TARGET_MINUTES);
  });

  it("keeps four minutes for levels 0 and 1, then adds a minute every two levels", () => {
    expect(strengthRepsPerExercise(0)).toBe(5);
    expect(strengthDailyGoalMinutes(0)).toBe(4);
    expect(strengthRepsPerExercise(1)).toBe(6);
    expect(strengthDailyGoalMinutes(1)).toBe(4);
    expect(strengthRepsPerExercise(2)).toBe(7);
    expect(strengthDailyGoalMinutes(2)).toBe(5);
    expect(strengthRepsPerExercise(3)).toBe(8);
    expect(strengthDailyGoalMinutes(3)).toBe(5);
    expect(strengthRepsPerExercise(4)).toBe(9);
    expect(strengthDailyGoalMinutes(4)).toBe(6);
    expect(STRENGTH_WORKOUT_REPS_BEFORE_MINUTE_BUMP).toBe(2);
  });

  it("treats legacy baseline minutes as level 0", () => {
    expect(resolveStrengthProgressionLevel(4)).toBe(0);
    expect(resolveStrengthProgressionLevel(4, 4)).toBe(0);
    expect(resolveStrengthProgressionLevel(0)).toBe(0);
    expect(resolveStrengthProgressionLevel(2)).toBe(2);
  });

  it("distinguishes level 4 from legacy baseline 4 using current goal", () => {
    expect(resolveStrengthProgressionLevel(4, 6)).toBe(4);
    expect(strengthRepsPerExercise(resolveStrengthProgressionLevel(4, 6))).toBe(9);
    expect(strengthDailyGoalMinutes(resolveStrengthProgressionLevel(4, 6))).toBe(6);
  });
});
