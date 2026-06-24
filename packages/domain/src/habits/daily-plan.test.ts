import { describe, expect, it } from "vitest";
import {
  FOREIGN_LANGUAGE_HABIT_NAME,
  MEDITATION_HABIT_NAME,
} from "@mytodo/shared";
import { buildDailyPlan, goalToMinutes } from "./daily-plan.js";

describe("goalToMinutes", () => {
  it("converts pages at 2 pages per minute", () => {
    expect(goalToMinutes("pages", 10)).toBe(5);
  });

  it("converts reps at 2 seconds each", () => {
    expect(goalToMinutes("reps", 30)).toBe(1);
  });
});

describe("buildDailyPlan", () => {
  const habits = [
    { id: "h1", name: "Книги", icon: null, unit: "pages" as const, current_goal: 20, checkin_value: 0 },
    { id: "h2", name: "Бег", icon: null, unit: "minutes" as const, current_goal: 15, checkin_value: 0, template_id: "running" },
  ];

  it("returns empty blocks when all goals met", () => {
    const plan = buildDailyPlan({
      date: "2026-06-24",
      budgetMin: 60,
      habits: habits.map((h) => ({ ...h, checkin_value: h.current_goal })),
    });
    expect(plan.blocks).toHaveLength(0);
    expect(plan.minutes_planned).toBe(0);
    expect(plan.minutes_completed).toBe(0);
    expect(plan.minutes_remaining).toBe(60);
  });

  it("scales down when total needed exceeds budget", () => {
    const plan = buildDailyPlan({ date: "2026-06-24", budgetMin: 10, habits });
    const planned = plan.blocks.reduce((s, b) => s + b.duration_min, 0);
    expect(planned).toBeLessThanOrEqual(10);
  });

  it("creates one block per habit without duplicates", () => {
    const plan = buildDailyPlan({ date: "2026-06-24", budgetMin: 60, habits });
    expect(plan.blocks).toHaveLength(2);
    const ids = plan.blocks.map((b) => b.habit_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("allocates meditation as a single 1-minute block", () => {
    const plan = buildDailyPlan({
      date: "2026-06-24",
      budgetMin: 60,
      habits: [
        {
          id: "med",
          name: MEDITATION_HABIT_NAME,
          icon: null,
          unit: "minutes",
          current_goal: 20,
          checkin_value: 0,
        },
        {
          id: "run",
          name: "Бег",
          icon: null,
          unit: "minutes",
          current_goal: 20,
          checkin_value: 0,
          template_id: "running",
        },
      ],
    });

    const meditation = plan.blocks.find((block) => block.habit_id === "med");
    expect(meditation?.duration_min).toBe(1);
    expect(plan.blocks.filter((block) => block.habit_id === "med")).toHaveLength(1);
  });

  it("allocates foreign language as a 20-minute block", () => {
    const plan = buildDailyPlan({
      date: "2026-06-24",
      budgetMin: 60,
      habits: [
        {
          id: "lang",
          name: FOREIGN_LANGUAGE_HABIT_NAME,
          icon: null,
          unit: "minutes",
          current_goal: 20,
          checkin_value: 0,
        },
        {
          id: "med",
          name: MEDITATION_HABIT_NAME,
          icon: null,
          unit: "minutes",
          current_goal: 20,
          checkin_value: 0,
        },
        {
          id: "run",
          name: "Бег",
          icon: null,
          unit: "minutes",
          current_goal: 20,
          checkin_value: 0,
          template_id: "running",
        },
      ],
    });

    const language = plan.blocks.find((block) => block.habit_id === "lang");
    expect(language?.duration_min).toBe(20);
    expect(plan.blocks).toHaveLength(3);
    expect(new Set(plan.blocks.map((block) => block.habit_id)).size).toBe(3);
  });

  it("allocates books as a single 10-minute block for beginner page goal", () => {
    const plan = buildDailyPlan({
      date: "2026-06-24",
      budgetMin: 60,
      habits: [
        {
          id: "books",
          name: "Читать книги",
          icon: null,
          unit: "pages",
          current_goal: 5,
          checkin_value: 0,
          template_id: "books",
        },
      ],
    });

    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0]?.duration_min).toBe(10);
    expect(plan.blocks[0]?.expected_yield).toBe(20);
  });

  it("uses new block ids after partial progress so completed blocks are not reused", () => {
    const before = buildDailyPlan({
      date: "2026-06-24",
      budgetMin: 60,
      habits: [{ id: "h1", name: "Книги", icon: null, unit: "pages", current_goal: 20, checkin_value: 0 }],
    });
    const firstBlockId = before.blocks[0]!.id;

    const after = buildDailyPlan({
      date: "2026-06-24",
      budgetMin: 60,
      habits: [{ id: "h1", name: "Книги", icon: null, unit: "pages", current_goal: 20, checkin_value: 5 }],
      completedBlockIds: new Set([firstBlockId]),
    });

    const pendingBlocks = after.blocks.filter((block) => block.status === "pending");
    expect(pendingBlocks.length).toBeGreaterThan(0);
    expect(pendingBlocks.some((block) => block.id === firstBlockId)).toBe(false);
  });
});
