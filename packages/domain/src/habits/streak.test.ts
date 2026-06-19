import { describe, expect, it } from "vitest";
import {
  computeGlobalStreak,
  computeHabitStreak,
  getWeekStartMonday,
  isDateInRange,
} from "./streak.js";

describe("computeHabitStreak", () => {
  it("counts consecutive success and skipped days before today", () => {
    const streak = computeHabitStreak(
      [
        { date: "2026-06-18", status: "success" },
        { date: "2026-06-17", status: "skipped" },
        { date: "2026-06-16", status: "success" },
        { date: "2026-06-15", status: "fail" },
      ],
      "2026-06-19",
    );

    expect(streak).toBe(3);
  });

  it("ignores today and stops on missing past day", () => {
    const streak = computeHabitStreak(
      [{ date: "2026-06-18", status: "success" }],
      "2026-06-19",
    );

    expect(streak).toBe(1);
  });

  it("returns zero when yesterday failed", () => {
    const streak = computeHabitStreak(
      [{ date: "2026-06-18", status: "fail" }],
      "2026-06-19",
    );

    expect(streak).toBe(0);
  });
  it("returns zero when today has a fail checkin", () => {
    expect(
      computeHabitStreak(
        [
          { date: "2026-06-18", status: "success" },
          { date: "2026-06-19", status: "fail" },
        ],
        "2026-06-19",
      ),
    ).toBe(0);
  });

  it("treats closed abstinence days without checkin as success", () => {
    expect(
      computeHabitStreak([], "2026-06-19", "2026-06-15", "abstinence"),
    ).toBe(4);
  });

  it("still breaks abstinence streak on explicit fail", () => {
    expect(
      computeHabitStreak(
        [{ date: "2026-06-18", status: "fail" }],
        "2026-06-19",
        "2026-06-01",
        "abstinence",
      ),
    ).toBe(0);
  });

  it("stops before activeFrom date", () => {
    const streak = computeHabitStreak(
      [
        { date: "2026-06-18", status: "success" },
        { date: "2026-06-17", status: "success" },
      ],
      "2026-06-19",
      "2026-06-18",
    );

    expect(streak).toBe(1);
  });
});

describe("computeGlobalStreak", () => {
  it("requires every active habit to succeed or skip on each day", () => {
    const records = new Map([
      [
        "habit-a",
        [
          { date: "2026-06-18", status: "success" as const },
          { date: "2026-06-17", status: "success" as const },
        ],
      ],
      [
        "habit-b",
        [
          { date: "2026-06-18", status: "skipped" as const },
          { date: "2026-06-17", status: "fail" as const },
        ],
      ],
    ]);

    const habits = [
      { id: "habit-a", activeFrom: "2026-06-01", type: "target" as const, phase: "reduction" as const },
      { id: "habit-b", activeFrom: "2026-06-01", type: "limit" as const, phase: "reduction" as const },
    ];

    expect(computeGlobalStreak(records, habits, "2026-06-19")).toBe(1);
  });

  it("ignores habits before their activeFrom date", () => {
    const records = new Map([
      [
        "habit-a",
        [
          { date: "2026-06-19", status: "success" as const },
          { date: "2026-06-18", status: "success" as const },
        ],
      ],
      ["habit-b", [{ date: "2026-06-19", status: "success" as const }]],
    ]);

    const habits = [
      { id: "habit-a", activeFrom: "2026-06-01", type: "target" as const, phase: "reduction" as const },
      { id: "habit-b", activeFrom: "2026-06-19", type: "limit" as const, phase: "reduction" as const },
    ];

    expect(computeGlobalStreak(records, habits, "2026-06-20")).toBe(2);
  });

  it("counts implied success for abstinence in global streak", () => {
    const records = new Map([
      ["habit-a", [{ date: "2026-06-17", status: "fail" as const }]],
      ["habit-b", []],
    ]);

    const habits = [{ id: "habit-b", activeFrom: "2026-06-15", type: "abstinence" as const, phase: "abstinence" as const }];

    expect(computeGlobalStreak(records, habits, "2026-06-19")).toBe(4);
  });

  it("returns zero when there are no habits", () => {
    expect(computeGlobalStreak(new Map(), [], "2026-06-19")).toBe(0);
  });
});

describe("getWeekStartMonday", () => {
  it("returns Monday for a Wednesday", () => {
    expect(getWeekStartMonday("2026-06-18")).toBe("2026-06-15");
  });

  it("returns previous Monday for Sunday", () => {
    expect(getWeekStartMonday("2026-06-21")).toBe("2026-06-15");
  });
});

describe("isDateInRange", () => {
  it("checks inclusive boundaries", () => {
    expect(isDateInRange("2026-06-17", "2026-06-15", "2026-06-19")).toBe(true);
    expect(isDateInRange("2026-06-14", "2026-06-15", "2026-06-19")).toBe(false);
  });
});
