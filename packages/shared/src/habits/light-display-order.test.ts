import { describe, expect, it } from "vitest";
import { HABIT_CATEGORY_KEYS, HABIT_TEMPLATES, HABIT_TEMPLATE_IDS } from "../constants/habits.js";
import {
  compareLightHabitsForDisplay,
  LIGHT_HABIT_DISPLAY_ORDER,
  sortLightHabitsForDisplay,
} from "./light-display-order.js";

describe("LIGHT_HABIT_DISPLAY_ORDER coverage", () => {
  it("includes every light category key and template", () => {
    for (const categoryKey of HABIT_CATEGORY_KEYS) {
      expect(LIGHT_HABIT_DISPLAY_ORDER).toContain(categoryKey);
    }

    for (const templateId of HABIT_TEMPLATE_IDS) {
      if (HABIT_TEMPLATES[templateId].side !== "light") {
        continue;
      }
      expect(LIGHT_HABIT_DISPLAY_ORDER).toContain(`template:${templateId}`);
    }
  });

  it("sorts full demo light set in day-flow order", () => {
    const habits = [
      { name: "Чтение книг", template_id: "books" as const },
      { name: "Бег", template_id: "running" as const },
      { name: "Планка", template_id: "plank" as const },
      { name: "Медитация", category_key: "meditation" as const },
      { name: "Иностранный язык", category_key: "language" as const },
      { name: "Дневник благодарности", category_key: "gratitude" as const },
      { name: "Силовая тренировка", category_key: "strength_workout" as const },
      { name: "Разминка", category_key: "stretching" as const },
      { name: "Программирование", category_key: "programming" as const },
      { name: "Творческий проект", category_key: "creative_project" as const },
      { name: "Ходьба на свежем воздухе", category_key: "walking" as const },
      { name: "Ранний подъём", category_key: "early_rise" as const },
      { name: "Правильное питание", category_key: "healthy_nutrition" as const },
    ];

    expect(sortLightHabitsForDisplay(habits).map((habit) => habit.name)).toEqual([
      "Ранний подъём",
      "Медитация",
      "Правильное питание",
      "Разминка",
      "Бег",
      "Силовая тренировка",
      "Планка",
      "Иностранный язык",
      "Программирование",
      "Творческий проект",
      "Дневник благодарности",
      "Чтение книг",
      "Ходьба на свежем воздухе",
    ]);
  });
});

describe("compareLightHabitsForDisplay", () => {
  it("orders morning habits before after-work physical block", () => {
    expect(
      compareLightHabitsForDisplay(
        { name: "Ранний подъём", category_key: "early_rise" },
        { name: "Медитация", category_key: "meditation" },
      ),
    ).toBeLessThan(0);
    expect(
      compareLightHabitsForDisplay(
        { name: "Медитация", category_key: "meditation" },
        { name: "Разминка", category_key: "stretching" },
      ),
    ).toBeLessThan(0);
  });

  it("orders physical before mental and mental before gratitude, reading and walk", () => {
    expect(
      compareLightHabitsForDisplay(
        { name: "Бег", template_id: "running" },
        { name: "Силовая тренировка", category_key: "strength_workout" },
      ),
    ).toBeLessThan(0);
    expect(
      compareLightHabitsForDisplay(
        { name: "Силовая тренировка", category_key: "strength_workout" },
        { name: "Иностранный язык", category_key: "language" },
      ),
    ).toBeLessThan(0);
    expect(
      compareLightHabitsForDisplay(
        { name: "Программирование", category_key: "programming" },
        { name: "Дневник благодарности", category_key: "gratitude" },
      ),
    ).toBeLessThan(0);
    expect(
      compareLightHabitsForDisplay(
        { name: "Дневник благодарности", category_key: "gratitude" },
        { name: "Чтение книг", template_id: "books" },
      ),
    ).toBeLessThan(0);
    expect(
      compareLightHabitsForDisplay(
        { name: "Чтение книг", template_id: "books" },
        { name: "Ходьба на свежем воздухе", category_key: "walking" },
      ),
    ).toBeLessThan(0);
  });

  it("sorts showcase habits in day-flow order", () => {
    const sorted = sortLightHabitsForDisplay([
      { name: "Чтение книг", template_id: "books" },
      { name: "Ранний подъём", category_key: "early_rise" },
      { name: "Иностранный язык", category_key: "language" },
      { name: "Медитация", category_key: "meditation" },
      { name: "Дневник благодарности", category_key: "gratitude" },
      { name: "Бег", template_id: "running" },
      { name: "Силовая тренировка", category_key: "strength_workout" },
    ]);

    expect(sorted.map((habit) => habit.name)).toEqual([
      "Ранний подъём",
      "Медитация",
      "Бег",
      "Силовая тренировка",
      "Иностранный язык",
      "Дневник благодарности",
      "Чтение книг",
    ]);
  });
});
