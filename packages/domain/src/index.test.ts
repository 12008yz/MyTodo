import { describe, expect, it } from "vitest";
import { calibrateHabit } from "./index.js";
import { HABIT_TEMPLATES } from "@mytodo/shared";

describe("domain package", () => {
  it("exports calibrateHabit", () => {
    const result = calibrateHabit({
      kind: "template",
      templateId: "books",
      template: HABIT_TEMPLATES.books,
      baselineValue: 1,
      profile: {
        dailyBudgetMin: 60,
        age: 25,
        gender: "male",
        weightKg: 70,
        heightCm: 175,
      },
      activeLightHabitsIncludingNew: 1,
    });

    expect(result.currentGoal).toBeGreaterThan(0);
  });
});
