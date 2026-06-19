import { describe, expect, it } from "vitest";
import { computeNextGoal, type HabitForProgression } from "./progression.js";

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
  it("increases light habit goal after success", () => {
    expect(computeNextGoal(lightTarget(10), "success")).toBe(11);
  });

  it("keeps light habit goal after fail or skipped", () => {
    expect(computeNextGoal(lightTarget(10), "fail")).toBe(10);
    expect(computeNextGoal(lightTarget(10), "skipped")).toBe(10);
  });

  it("decreases dark limit goal after success", () => {
    expect(computeNextGoal(darkLimit(20), "success")).toBe(19);
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
});
