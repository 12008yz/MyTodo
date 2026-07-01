import { describe, expect, it } from "vitest";
import type { StatsCalendarResponse } from "@mytodo/shared";
import { buildHabitTrendSeries, formatTrendAxisLabel, formatTrendTooltipDate } from "./buildHabitTrendSeries";

function calendar(
  month: string,
  days: StatsCalendarResponse["days"],
): StatsCalendarResponse {
  return { month, days };
}

describe("buildHabitTrendSeries", () => {
  it("builds daily points for all light-side habits", () => {
    const result = buildHabitTrendSeries(
      [
        calendar("2026-06", [
          {
            date: "2026-06-01",
            color: "success",
            habits: [
              {
                habit_id: "a",
                name: "Книги",
                side: "light",
                type: "target",
                phase: "reduction",
                unit: "pages",
                template_id: "books",
                status: "success",
                value: 5,
                goal: 5,
                minutes_total: 20,
              },
              {
                habit_id: "b",
                name: "Спорт",
                side: "light",
                type: "target",
                phase: "reduction",
                unit: "minutes",
                template_id: "running",
                status: "success",
                value: 30,
                goal: 30,
                minutes_total: 30,
              },
            ],
          },
          {
            date: "2026-06-02",
            color: "success",
            habits: [
              {
                habit_id: "a",
                name: "Книги",
                side: "light",
                type: "target",
                phase: "reduction",
                unit: "pages",
                template_id: "books",
                status: "success",
                value: 3,
                goal: 5,
                minutes_total: 10,
              },
              {
                habit_id: "b",
                name: "Спорт",
                side: "light",
                type: "target",
                phase: "reduction",
                unit: "minutes",
                template_id: "running",
                status: "pending",
                value: null,
                goal: 30,
                minutes_total: 0,
              },
            ],
          },
        ]),
      ],
      "light",
      "2026-06-01",
      "2026-06-02",
      "week",
    );

    expect(result.total).toBe(38);
    expect(result.unit).toBeNull();
    expect(result.series).toHaveLength(2);
    expect(result.series.map((item) => item.label)).toEqual(["Спорт", "Книги"]);
    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toMatchObject({ date: "2026-06-01", series0: 30, series1: 5 });
    expect(result.points[1]).toMatchObject({ date: "2026-06-02", series0: 0, series1: 3 });
  });

  it("includes every habit as a series on dark side", () => {
    const result = buildHabitTrendSeries(
      [
        calendar("2026-06", [
          {
            date: "2026-06-01",
            color: "fail",
            habits: [
              {
                habit_id: "smoke",
                name: "Курение",
                side: "dark",
                type: "limit",
                phase: "reduction",
                unit: "cigarettes",
                template_id: "smoking",
                status: "fail",
                value: 4,
                goal: 12,
                minutes_total: 0,
              },
              {
                habit_id: "abst",
                name: "Алкоголь",
                side: "dark",
                type: "abstinence",
                phase: "abstinence",
                unit: null,
                template_id: null,
                status: "success",
                value: null,
                goal: null,
                minutes_total: 0,
              },
            ],
          },
        ]),
      ],
      "dark",
      "2026-06-01",
      "2026-06-01",
      "week",
    );

    expect(result.total).toBe(5);
    expect(result.unit).toBeNull();
    expect(result.series.map((series) => series.label)).toEqual(["Курение", "Алкоголь"]);
    expect(result.points[0]).toMatchObject({ series0: 4, series1: 1 });
  });

  it("counts abstinence success days on dark side", () => {
    const result = buildHabitTrendSeries(
      [
        calendar("2026-06", [
          {
            date: "2026-06-01",
            color: "success",
            habits: [
              {
                habit_id: "nails",
                name: "Грызть ногти",
                side: "dark",
                type: "abstinence",
                phase: "abstinence",
                unit: null,
                template_id: "nail_biting",
                status: "success",
                value: null,
                goal: null,
                minutes_total: 0,
              },
            ],
          },
          {
            date: "2026-06-02",
            color: "fail",
            habits: [
              {
                habit_id: "nails",
                name: "Грызть ногти",
                side: "dark",
                type: "abstinence",
                phase: "abstinence",
                unit: null,
                template_id: "nail_biting",
                status: "fail",
                value: null,
                goal: null,
                minutes_total: 0,
              },
            ],
          },
        ]),
      ],
      "dark",
      "2026-06-01",
      "2026-06-02",
      "week",
    );

    expect(result.total).toBe(1);
    expect(result.unit).toBe("days");
    expect(result.series[0]?.total).toBe(1);
    expect(result.points[0]).toMatchObject({ series0: 1 });
    expect(result.points[1]).toMatchObject({ series0: 0 });
  });

  it("uses checkin value for light habits when minutes_total is still zero", () => {
    const result = buildHabitTrendSeries(
      [
        calendar("2026-06", [
          {
            date: "2026-06-01",
            color: "success",
            habits: [
              {
                habit_id: "running",
                name: "Бег",
                side: "light",
                type: "target",
                phase: "reduction",
                unit: "minutes",
                template_id: "running",
                status: "success",
                value: 25,
                goal: 30,
                minutes_total: 0,
              },
            ],
          },
        ]),
      ],
      "light",
      "2026-06-01",
      "2026-06-01",
      "week",
    );

    expect(result.points[0]).toMatchObject({ series0: 25 });
  });

  it("includes all habits when more than three exist", () => {
    const habits = Array.from({ length: 5 }, (_, index) => ({
      habit_id: `habit-${index}`,
      name: `Привычка ${index}`,
      side: "light" as const,
      type: "target" as const,
      phase: "reduction" as const,
      unit: "minutes" as const,
      template_id: "running" as const,
      status: "success" as const,
      value: index + 1,
      goal: 10,
      minutes_total: (index + 1) * 10,
    }));

    const result = buildHabitTrendSeries(
      [
        calendar("2026-06", [
          {
            date: "2026-06-01",
            color: "success",
            habits,
          },
        ]),
      ],
      "light",
      "2026-06-01",
      "2026-06-01",
      "week",
    );

    expect(result.series).toHaveLength(5);
    expect(result.series.map((item) => item.label)).toEqual([
      "Привычка 4",
      "Привычка 3",
      "Привычка 2",
      "Привычка 1",
      "Привычка 0",
    ]);
  });

  it("includes habits with zero activity in the selected period", () => {
    const result = buildHabitTrendSeries(
      [
        calendar("2026-06", [
          {
            date: "2026-06-01",
            color: "success",
            habits: [
              {
                habit_id: "active",
                name: "Бег",
                side: "light",
                type: "target",
                phase: "reduction",
                unit: "minutes",
                template_id: "running",
                status: "success",
                value: 20,
                goal: 30,
                minutes_total: 20,
              },
              {
                habit_id: "idle",
                name: "Медитация",
                side: "light",
                type: "target",
                phase: "reduction",
                unit: "minutes",
                template_id: "meditation",
                status: "pending",
                value: null,
                goal: 10,
                minutes_total: 0,
              },
            ],
          },
        ]),
      ],
      "light",
      "2026-06-01",
      "2026-06-01",
      "week",
    );

    expect(result.series).toHaveLength(2);
    expect(result.series.map((item) => item.label)).toEqual(["Бег", "Медитация"]);
    expect(result.points[0]).toMatchObject({ series0: 20, series1: 0 });
  });

  it("builds one point per day across a long range", () => {
    const dates = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-06-${String(index + 1).padStart(2, "0")}`,
      color: "success" as const,
      habits: [
        {
          habit_id: "run",
          name: "Бег",
          side: "light" as const,
          type: "target" as const,
          phase: "reduction" as const,
          unit: "minutes" as const,
          template_id: "running" as const,
          status: "success" as const,
          value: 10,
          goal: 30,
          minutes_total: 10,
        },
      ],
    }));

    const result = buildHabitTrendSeries(
      [calendar("2026-06", dates)],
      "light",
      "2026-06-01",
      "2026-06-30",
      "month",
    );

    expect(result.points).toHaveLength(30);
    expect(result.series).toHaveLength(1);
    expect(result.total).toBe(300);
  });

  it("uses month labels when a month range spans two calendar months", () => {
    expect(
      formatTrendAxisLabel("2026-06-28", "month", { start: "2026-06-02", end: "2026-07-01" }),
    ).toMatch(/28/);
    expect(
      formatTrendAxisLabel("2026-06-28", "month", { start: "2026-06-01", end: "2026-06-30" }),
    ).toBe("28");
  });

  it("formats tooltip dates with weekday and month", () => {
    expect(formatTrendTooltipDate("2026-06-18")).toContain("18");
    expect(formatTrendTooltipDate("2026-06-18")).toMatch(/июн/i);
  });
});
