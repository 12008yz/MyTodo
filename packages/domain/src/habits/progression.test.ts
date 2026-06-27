import { describe, expect, it } from "vitest";
import { computeNextGoal, applyDayProgression, type HabitForProgression } from "./progression.js";

const lightTarget = (currentGoal: number, growthStep = 1): HabitForProgression => ({
  type: "target",
  side: "light",
  currentGoal,
  growthStep,
  progressionDirection: "increase",
});

const darkLimit = (currentGoal: number, growthStep = 1): HabitForProgression => ({
  type: "limit",
  side: "dark",
  currentGoal,
  growthStep,
  progressionDirection: "decrease",
});

describe("computeNextGoal", () => {
  it("increases light habit goal only after interval successful days", () => {
    const habit: HabitForProgression = {
      ...lightTarget(10),
      progressionIntervalDays: 3,
      successDaysAtGoal: 0,
    };

    expect(computeNextGoal({ ...habit, successDaysAtGoal: 0 }, "success")).toBe(10);
    expect(computeNextGoal({ ...habit, successDaysAtGoal: 1 }, "success")).toBe(10);
    expect(computeNextGoal({ ...habit, successDaysAtGoal: 2 }, "success")).toBe(11);
  });

  it("increases light habit goal after success when interval is 1", () => {
    expect(computeNextGoal(lightTarget(10), "success")).toBe(11);
  });

  it("resets light success streak on fail", () => {
    const habit: HabitForProgression = {
      ...lightTarget(10),
      progressionIntervalDays: 3,
      successDaysAtGoal: 2,
    };

    expect(applyDayProgression(habit, "fail")).toEqual({
      nextGoal: 10,
      nextSuccessDaysAtGoal: 0,
    });
  });

  it("keeps light habit goal after fail or skipped", () => {
    expect(computeNextGoal(lightTarget(10), "fail")).toBe(10);
    expect(computeNextGoal(lightTarget(10), "skipped")).toBe(10);
  });

  it("decreases dark limit goal after success", () => {
    expect(computeNextGoal(darkLimit(20), "success")).toBe(19);
  });

  it("decreases dark limit goal only after interval successful days", () => {
    const habit: HabitForProgression = {
      ...darkLimit(20),
      progressionIntervalDays: 3,
      successDaysAtGoal: 0,
    };

    expect(computeNextGoal({ ...habit, successDaysAtGoal: 0 }, "success")).toBe(20);
    expect(computeNextGoal({ ...habit, successDaysAtGoal: 1 }, "success")).toBe(20);
    expect(computeNextGoal({ ...habit, successDaysAtGoal: 2 }, "success")).toBe(19);
  });

  it("resets success streak on fail for interval habits", () => {
    const habit: HabitForProgression = {
      ...darkLimit(20),
      progressionIntervalDays: 3,
      successDaysAtGoal: 2,
    };

    expect(applyDayProgression(habit, "fail")).toEqual({
      nextGoal: 20,
      nextSuccessDaysAtGoal: 0,
    });
  });

  it("does not go below zero for dark limit", () => {
    expect(computeNextGoal(darkLimit(0), "success")).toBe(0);
    expect(computeNextGoal(darkLimit(3, 5), "success")).toBe(0);
  });

  it("respects custom minGoal for decreasing habits (social media)", () => {
    const socialMedia: HabitForProgression = {
      ...darkLimit(18, 5),
      minGoal: 15,
    };

    expect(computeNextGoal(socialMedia, "success")).toBe(15);
    expect(computeNextGoal({ ...socialMedia, currentGoal: 20 }, "success")).toBe(15);
    expect(computeNextGoal({ ...socialMedia, currentGoal: 15 }, "success")).toBe(15);
  });

  it("keeps dark limit goal after fail", () => {
    expect(computeNextGoal(darkLimit(15), "fail")).toBe(15);
  });

  it("keeps abstinence goal unchanged", () => {
    const abstinence: HabitForProgression = {
      type: "abstinence",
      side: "dark",
      currentGoal: 0,
      growthStep: 1,
      progressionDirection: "abstain",
    };

    expect(computeNextGoal(abstinence, "success")).toBe(0);
    expect(computeNextGoal(abstinence, "fail")).toBe(0);
  });

  it("increases strength workout reps every interval and minutes every two levels", () => {
    const strength: HabitForProgression = {
      ...lightTarget(4),
      categoryKey: "strength_workout",
      baselineValue: 0,
      growthStep: 1,
      progressionIntervalDays: 3,
      successDaysAtGoal: 0,
    };

    expect(applyDayProgression({ ...strength, successDaysAtGoal: 0 }, "success")).toEqual({
      nextGoal: 4,
      nextSuccessDaysAtGoal: 1,
    });
    expect(applyDayProgression({ ...strength, successDaysAtGoal: 1 }, "success")).toEqual({
      nextGoal: 4,
      nextSuccessDaysAtGoal: 2,
    });
    expect(applyDayProgression({ ...strength, successDaysAtGoal: 2 }, "success")).toEqual({
      nextGoal: 4,
      nextSuccessDaysAtGoal: 0,
      nextBaselineValue: 1,
    });

    const levelOne: HabitForProgression = {
      ...strength,
      baselineValue: 1,
      successDaysAtGoal: 2,
    };
    expect(applyDayProgression(levelOne, "success")).toEqual({
      nextGoal: 5,
      nextSuccessDaysAtGoal: 0,
      nextBaselineValue: 2,
    });
  });
});
