import { describe, expect, it } from "vitest";
import type { StatsCalendarResponse } from "@mytodo/shared";
import { habitChartMetric, habitChartUnit } from "./habitChartMetric";

type CalendarHabit = StatsCalendarResponse["days"][number]["habits"][number];

function habit(overrides: Partial<CalendarHabit> & Pick<CalendarHabit, "habit_id" | "name">): CalendarHabit {
  return {
    side: "light",
    type: "target",
    phase: "reduction",
    unit: "minutes",
    template_id: "running",
    status: "success",
    value: null,
    goal: 30,
    minutes_total: 0,
    ...overrides,
  };
}

describe("habitChartMetric", () => {
  it("uses minutes_total or checkin value for light minute habits", () => {
    expect(
      habitChartMetric(
        habit({
          habit_id: "run",
          name: "Бег",
          value: 25,
          minutes_total: 0,
        }),
        "light",
      ),
    ).toBe(25);

    expect(
      habitChartMetric(
        habit({
          habit_id: "run",
          name: "Бег",
          value: 10,
          minutes_total: 30,
        }),
        "light",
      ),
    ).toBe(30);
  });

  it("uses page values for books", () => {
    expect(
      habitChartMetric(
        habit({
          habit_id: "books",
          name: "Книги",
          unit: "pages",
          template_id: "books",
          value: 7,
          minutes_total: 20,
        }),
        "light",
      ),
    ).toBe(7);
  });

  it("uses seconds value for plank", () => {
    expect(
      habitChartMetric(
        habit({
          habit_id: "plank",
          name: "Планка",
          unit: "seconds",
          template_id: "plank",
          value: 45,
        }),
        "light",
      ),
    ).toBe(45);
  });

  it("uses limit value on dark side", () => {
    expect(
      habitChartMetric(
        habit({
          habit_id: "smoke",
          name: "Курение",
          side: "dark",
          type: "limit",
          unit: "cigarettes",
          template_id: "smoking",
          status: "fail",
          value: 4,
        }),
        "dark",
      ),
    ).toBe(4);
  });

  it("counts abstinence success as one day", () => {
    expect(
      habitChartMetric(
        habit({
          habit_id: "nails",
          name: "Ногти",
          side: "dark",
          type: "abstinence",
          phase: "abstinence",
          unit: null,
          template_id: "nail_biting",
          status: "success",
        }),
        "dark",
      ),
    ).toBe(1);

    expect(
      habitChartMetric(
        habit({
          habit_id: "nails",
          name: "Ногти",
          side: "dark",
          type: "abstinence",
          phase: "abstinence",
          unit: null,
          template_id: "nail_biting",
          status: "fail",
        }),
        "dark",
      ),
    ).toBe(0);
  });

  it("returns native units per habit", () => {
    expect(habitChartUnit(habit({ habit_id: "books", name: "Книги", unit: "pages", template_id: "books" }), "light")).toBe(
      "pages",
    );
    expect(habitChartUnit(habit({ habit_id: "run", name: "Бег" }), "light")).toBe("minutes");
    expect(
      habitChartUnit(
        habit({
          habit_id: "smoke",
          name: "Курение",
          side: "dark",
          type: "limit",
          unit: "cigarettes",
          template_id: "smoking",
        }),
        "dark",
      ),
    ).toBe("cigarettes");
  });
});
