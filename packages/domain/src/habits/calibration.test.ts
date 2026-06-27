import { describe, expect, it } from "vitest";
import {
  FOREIGN_LANGUAGE_HABIT_NAME,
  HABIT_TEMPLATES,
  MEDITATION_HABIT_NAME,
  resolveStrengthProgressionLevel,
  strengthRepsPerExercise,
} from "@mytodo/shared";
import { calibrateHabit, recalculateLightGoal } from "./calibration.js";
import {
  computeBmi,
  distributeGoalsAcrossBudget,
  estimateHabitsComfortMinutes,
  estimateHabitsComfortMinutesWithSetup,
  roundComfortMinutesTotal,
  recommendDailyMinutes,
  recommendLightGoal,
  resolveLightActivityId,
  formatHabitComfortLabelWithSetup,
} from "./workload.js";

const profile = {
  dailyBudgetMin: 60,
  age: 30,
  gender: "male" as const,
  weightKg: 80,
  heightCm: 180,
};

describe("workload", () => {
  it("starts early rise at zero shift from registered wake time", () => {
    expect(
      recommendLightGoal(
        { name: "Ранний подъём", unit: "minutes", templateId: null, categoryKey: "early_rise" },
        profile,
        0,
      ),
    ).toBe(0);
  });

  it("computes BMI", () => {
    expect(computeBmi(80, 180)).toBeCloseTo(24.7, 1);
  });

  it("resolves onboarding activity ids", () => {
    expect(resolveLightActivityId({ name: MEDITATION_HABIT_NAME, unit: "minutes" })).toBe(
      "mindfulness-meditation",
    );
    expect(resolveLightActivityId({ name: FOREIGN_LANGUAGE_HABIT_NAME, unit: "minutes" })).toBe(
      "mindfulness-language",
    );
    expect(
      resolveLightActivityId({
        name: HABIT_TEMPLATES.running.name,
        unit: "minutes",
        templateId: "running",
      }),
    ).toBe("strength-running");
  });

  it("prefers categoryKey over habit name for custom habits", () => {
    expect(
      resolveLightActivityId({
        name: "Любое название",
        unit: "minutes",
        categoryKey: "meditation",
      }),
    ).toBe("mindfulness-meditation");
    expect(
      resolveLightActivityId({
        name: "Любое название",
        unit: "reps",
        categoryKey: "strength_workout",
      }),
    ).toBe("strength-workout");
  });

  it("recommends meditation as 1 min, gratitude as 2 min, and language as 25 min", () => {
    expect(recommendDailyMinutes("mindfulness-meditation", profile)).toBe(1);
    expect(recommendDailyMinutes("mindfulness-gratitude", profile)).toBe(2);
    expect(recommendDailyMinutes("mindfulness-language", profile)).toBe(25);
  });

  it("keeps running at least 10 min regardless of age", () => {
    const young = recommendDailyMinutes("strength-running", profile);
    const senior = recommendDailyMinutes("strength-running", {
      ...profile,
      age: 68,
      weightKg: 95,
      heightCm: 175,
    });
    expect(young).toBe(10);
    expect(senior).toBe(10);
  });

  it("recommends strength workout circuit at 4 min for level 0", () => {
    expect(recommendDailyMinutes("strength-workout", profile)).toBe(4);
    const goal = recommendLightGoal(
      {
        name: "Силовая тренировка",
        unit: "minutes",
        categoryKey: "strength_workout",
      },
      profile,
      0,
    );
    expect(goal).toBe(4);
  });

  it("recommends strength workout minutes from progression level", () => {
    const habit = {
      name: "Силовая тренировка",
      unit: "minutes" as const,
      categoryKey: "strength_workout" as const,
    };

    expect(recommendLightGoal(habit, profile, 1)).toBe(4);
    expect(recommendLightGoal(habit, profile, 2)).toBe(5);
    expect(recommendLightGoal(habit, profile, 3)).toBe(5);
    expect(recommendLightGoal(habit, profile, 4, 6)).toBe(6);
    expect(recommendLightGoal(habit, profile, 10)).toBe(9);
  });

  it("estimates strength workout comfort from onboarding reps", () => {
    const habit = {
      name: "Силовая тренировка",
      unit: "minutes" as const,
      categoryKey: "strength_workout" as const,
    };

    expect(
      estimateHabitsComfortMinutesWithSetup([
        { habit, practicesNow: true, baselineValue: 4 },
      ]),
    ).toBe(3);
    expect(
      estimateHabitsComfortMinutesWithSetup([
        { habit, practicesNow: true, baselineValue: 3 },
      ]),
    ).toBe(3);
    expect(
      estimateHabitsComfortMinutesWithSetup([
        { habit, practicesNow: true, baselineValue: 10 },
      ]),
    ).toBe(6);
    expect(
      formatHabitComfortLabelWithSetup({
        habit,
        practicesNow: true,
        baselineValue: 4,
      }),
    ).toBe("4 повт. × 4 (~3 мин)");
    expect(
      formatHabitComfortLabelWithSetup({
        habit,
        practicesNow: true,
        baselineValue: 3,
      }),
    ).toBe("3 повт. × 4 (~3 мин)");
    expect(
      formatHabitComfortLabelWithSetup({
        habit,
        practicesNow: true,
        baselineValue: 10,
      }),
    ).toBe("10 повт. × 4 (~6 мин)");
  });

  it("uses entered baseline for comfort minutes total", () => {
    const beginner = estimateHabitsComfortMinutesWithSetup([
      {
        habit: { name: FOREIGN_LANGUAGE_HABIT_NAME, unit: "minutes", categoryKey: "language" },
        practicesNow: false,
      },
      {
        habit: { name: MEDITATION_HABIT_NAME, unit: "minutes", categoryKey: "meditation" },
        practicesNow: true,
        baselineValue: 1,
      },
    ]);

    const withLanguageBaseline = estimateHabitsComfortMinutesWithSetup([
      {
        habit: { name: FOREIGN_LANGUAGE_HABIT_NAME, unit: "minutes", categoryKey: "language" },
        practicesNow: true,
        baselineValue: 35,
      },
      {
        habit: { name: MEDITATION_HABIT_NAME, unit: "minutes", categoryKey: "meditation" },
        practicesNow: true,
        baselineValue: 1,
      },
    ]);

    expect(withLanguageBaseline).toBeGreaterThan(beginner);
    expect(withLanguageBaseline - beginner).toBe(10);
  });

  it("rounds total comfort minutes up to a whole number", () => {
    expect(roundComfortMinutesTotal(16)).toBe(16);
    expect(roundComfortMinutesTotal(16.000001)).toBe(17);
    expect(roundComfortMinutesTotal(16.333333333333332)).toBe(17);

    const minutes = estimateHabitsComfortMinutes(
      [
        { name: HABIT_TEMPLATES.plank.name, unit: "seconds", templateId: "plank" },
        { name: MEDITATION_HABIT_NAME, unit: "minutes", categoryKey: "meditation" },
        { name: "Силовая тренировка", unit: "minutes", categoryKey: "strength_workout" },
      ],
      profile,
    );

    expect(minutes).toBe(Math.ceil(minutes));
    expect(minutes).toBeGreaterThan(0);
  });

  it("distributes goals across shared daily budget", () => {
    const femaleProfile = {
      dailyBudgetMin: 60,
      age: 28,
      gender: "female" as const,
      weightKg: 65,
      heightCm: 170,
    };
    const goals = distributeGoalsAcrossBudget(
      [
        {
          id: "books",
          habit: { name: "Чтение книг", unit: "pages", templateId: "books" },
          baselineValue: 5,
        },
        {
          id: "custom",
          habit: { name: "Blender 3D", unit: "minutes", templateId: null },
          baselineValue: 20,
        },
      ],
      femaleProfile,
    );

    expect(goals.get("books")).toBe(5);
    expect(goals.get("custom")).toBe(20);
  });
});

describe("calibrateHabit", () => {
  it("sets light template goal to max(baseline, personalized recommendation)", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "books",
      template: HABIT_TEMPLATES.books,
      baselineValue: 5,
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(5);
    expect(result.baselineValue).toBe(5);
    expect(result.growthStep).toBe(2);
    expect(result.progressionIntervalDays).toBe(2);
  });

  it("keeps baseline when it is higher than recommendation", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "running",
      template: HABIT_TEMPLATES.running,
      baselineValue: 2000,
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(2000);
  });

  it("personalizes running instead of splitting budget equally", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "running",
      template: HABIT_TEMPLATES.running,
      baselineValue: 0,
      profile,
      activeLightHabitsIncludingNew: 3,
    });

    expect(result.currentGoal).toBe(10);
  });

  it("calibrates meditation to a gentle daily goal", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Короткая пауза",
      unit: "minutes",
      baselineValue: 0,
      categoryKey: "meditation",
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(1);
    expect(result.categoryKey).toBe("meditation");
  });

  it("calibrates foreign language to 25 minutes", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Английский для работы",
      unit: "minutes",
      baselineValue: 0,
      categoryKey: "language",
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(25);
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
    expect(result.allowsWeeklySkip).toBe(false);
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
    expect(result.lastRelapseAt).toEqual(now);
  });

  it("calibrates early rise from wake-time shift with 5-minute growth every 3 days", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Ранний подъём",
      unit: "minutes",
      baselineValue: 0,
      categoryKey: "early_rise",
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBe(0);
    expect(result.growthStep).toBe(5);
    expect(result.progressionIntervalDays).toBe(3);
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

    expect(result.currentGoal).toBe(20);
    expect(result.growthStep).toBe(5);
    expect(result.progressionIntervalDays).toBe(3);
  });

  it("calibrates four onboarding reps below default five", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Силовая тренировка",
      unit: "minutes",
      baselineValue: 4,
      categoryKey: "strength_workout",
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.baselineValue).toBe(-1);
    expect(result.currentGoal).toBe(3);
    expect(
      strengthRepsPerExercise(
        resolveStrengthProgressionLevel(result.baselineValue, result.currentGoal),
      ),
    ).toBe(4);
  });

  it("calibrates three onboarding reps as entered", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Силовая тренировка",
      unit: "minutes",
      baselineValue: 3,
      categoryKey: "strength_workout",
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.baselineValue).toBe(-2);
    expect(result.currentGoal).toBe(3);
    expect(
      strengthRepsPerExercise(
        resolveStrengthProgressionLevel(result.baselineValue, result.currentGoal),
      ),
    ).toBe(3);
  });

  it("calibrates strength workout from onboarding reps", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Силовая тренировка",
      unit: "minutes",
      baselineValue: 10,
      categoryKey: "strength_workout",
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.baselineValue).toBe(5);
    expect(result.currentGoal).toBe(6);
  });

  it("calibrates 15 onboarding reps to level 10 with nine-minute goal", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Силовая тренировка",
      unit: "minutes",
      baselineValue: 15,
      categoryKey: "strength_workout",
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.baselineValue).toBe(10);
    expect(result.currentGoal).toBe(9);
    expect(
      strengthRepsPerExercise(
        resolveStrengthProgressionLevel(result.baselineValue, result.currentGoal),
      ),
    ).toBe(15);
  });

  it("calibrates strength workout from reps without category key", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Силовая тренировка",
      unit: "minutes",
      baselineValue: 15,
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.baselineValue).toBe(10);
    expect(result.currentGoal).toBe(9);
    expect(result.categoryKey).toBe("strength_workout");
  });

  it("calibrates strength workout beginner baseline at level 0", () => {
    const result = calibrateHabit({
      kind: "custom",
      name: "Силовая тренировка",
      unit: "minutes",
      baselineValue: 0,
      categoryKey: "strength_workout",
      profile,
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.baselineValue).toBe(0);
    expect(result.currentGoal).toBe(4);
  });

  it("calibrates plank starting at 20 seconds", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "plank",
      template: HABIT_TEMPLATES.plank,
      baselineValue: 0,
      profile: { ...profile, dailyBudgetMin: 30 },
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.unit).toBe("seconds");
    expect(result.currentGoal).toBe(20);
    expect(result.progressionIntervalDays).toBe(3);
  });

  it("recalculateLightGoal matches personalized habit identity", () => {
    const goal = recalculateLightGoal(
      5,
      { name: HABIT_TEMPLATES.books.name, unit: "pages", templateId: "books" },
      profile,
      2,
    );
    expect(goal).toBe(5);
  });
});
