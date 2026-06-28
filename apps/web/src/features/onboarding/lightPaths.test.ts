import { describe, expect, it } from "vitest";
import { getLightHabitSummary } from "./lightPaths";
import type { SelectedHabit } from "./types";

const earlyRiseHabit: SelectedHabit = {
  kind: "custom",
  name: "Ранний подъём",
  unit: "minutes",
  baseline: "0",
  pathId: "energy",
  activityId: "energy-early",
  categoryKey: "early_rise",
  practicesNow: true,
};

describe("getLightHabitSummary", () => {
  it("does not show wake time for early rise before schedule is configured", () => {
    expect(getLightHabitSummary(earlyRiseHabit)).toBe("");
    expect(getLightHabitSummary(earlyRiseHabit, undefined)).toBe("");
  });

  it("shows target wake time for early rise after schedule is configured", () => {
    expect(getLightHabitSummary(earlyRiseHabit, "07:00")).toBe("Подъём в 07:00");
    expect(getLightHabitSummary(earlyRiseHabit, "07:30")).toBe("Подъём в 07:30");
  });
});
