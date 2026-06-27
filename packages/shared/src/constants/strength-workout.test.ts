import { describe, expect, it } from "vitest";
import { STRENGTH_WORKOUT_TARGET_MINUTES } from "./sessions.js";
import {
  EXERCISE_MEDIA_CACHE_VERSION,
  STRENGTH_WORKOUT_EXERCISES,
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
    expect(STRENGTH_WORKOUT_EXERCISES.map((item) => item.demoGifUrl)).toEqual([
      "/exercises/squat.mp4",
      "/exercises/pushups.mp4",
      "/exercises/lunges.mp4",
      "/exercises/pullups.mp4",
    ]);
  });

  it("uses a versioned SW cache name (keep in sync with public/sw.js)", () => {
    expect(`mytodo-exercises-v${EXERCISE_MEDIA_CACHE_VERSION}`).toBe("mytodo-exercises-v1");
  });

  it("targets one short circuit per round", () => {
    expect(STRENGTH_WORKOUT_TARGET_MINUTES).toBe(5);
  });
});
