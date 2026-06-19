import { describe, expect, it } from "vitest";
import { HABIT_TEMPLATES } from "@mytodo/shared";
import { calibrateHabit, recalculateLightGoal } from "./calibration.js";

const profile = {
  dailyBudgetMin: 60,
  age: 30,
  gender: "male" as const,
  weightKg: 80,
  heightCm: 180,
};

describe("calibrateHabit", () => {
  it("sets light template goal to max(baseline, recommended)", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "books",
      template: HABIT_TEMPLATES.books,
      baselineValue: 5,
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(120);
    expect(result.baselineValue).toBe(5);
    expect(result.allowsWeeklySkip).toBe(true);
    expect(result.progressionDirection).toBe("increase");
  });

  it("keeps baseline when it is higher than recommendation", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "pushups",
      template: HABIT_TEMPLATES.pushups,
      baselineValue: 2000,
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(2000);
  });

  it("splits daily budget across light habits", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "running",
      template: HABIT_TEMPLATES.running,
      baselineValue: 0,
      profile,
      activeLightHabitsIncludingNew: 3,
    });

    expect(result.currentGoal).toBe(20);
  });

  it("calibrates dark limit habits from baseline", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "smoking",
      template: HABIT_TEMPLATES.smoking,
      baselineValue: 20,
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(20);
    expect(result.growthStep).toBe(1);
    expect(result.phase).toBe("reduction");
    expect(result.allowsWeeklySkip).toBe(false);
  });

  it("uses social media step of 5", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "social_media",
      template: HABIT_TEMPLATES.social_media,
      baselineValue: 120,
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(120);
    expect(result.growthStep).toBe(5);
  });

  it("initializes nail biting as abstinence with relapse timer", () => {
    const now = new Date("2026-06-19T12:00:00.000Z");
    const result = calibrateHabit({
      kind: "template",
      templateId: "nail_biting",
      template: HABIT_TEMPLATES.nail_biting,
      baselineValue: 0,
      profile,
      activeLightHabitsIncludingNew: 1,
      now,
    });

    expect(result.type).toBe("abstinence");
    expect(result.phase).toBe("abstinence");
    expect(result.baselineValue).toBe(0);
    expect(result.currentGoal).toBe(0);
    expect(result.lastRelapseAt).toEqual(now);
  });

  it("calibrates custom minute habits with step 5", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Blender 3D",
      unit: "minutes",
      baselineValue: 20,
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.isCustom).toBe(true);
    expect(result.currentGoal).toBe(60);
    expect(result.growthStep).toBe(5);
    expect(result.name).toBe("Blender 3D");
  });

  it("calibrates plank in seconds", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "plank",
      template: HABIT_TEMPLATES.plank,
      baselineValue: 30,
      profile: { ...profile, dailyBudgetMin: 30 },
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.unit).toBe("seconds");
    expect(result.currentGoal).toBe(1800);
  });

  it("recalculateLightGoal matches calibrateHabit for light habits", () => {
    const goal = recalculateLightGoal(5, "pages", profile, 2);
    expect(goal).toBe(60);
  });
});
