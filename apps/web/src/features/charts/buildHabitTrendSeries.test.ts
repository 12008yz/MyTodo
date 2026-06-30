import { describe, expect, it } from "vitest";
import type { StatsCalendarResponse } from "@mytodo/shared";
import { buildHabitTrendSeries } from "./buildHabitTrendSeries";

function calendar(
  month: string,
  days: StatsCalendarResponse["days"],
): StatsCalendarResponse {
  return { month, days };
}

describe("buildHabitTrendSeries", () => {
  it("builds daily points for top light-side habits", () => {
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
            ],
          },
        ]),
      ],
      "light",
      "2026-06-01",
      "2026-06-02",
      "week",
    );

    expect(result.total).toBe(60);
    expect(result.unit).toBe("minutes");
    expect(result.series).toHaveLength(2);
    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toMatchObject({ date: "2026-06-01", series0: 20, series1: 30 });
    expect(result.points[1]).toMatchObject({ date: "2026-06-02", series0: 10, series1: 0 });
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
});
