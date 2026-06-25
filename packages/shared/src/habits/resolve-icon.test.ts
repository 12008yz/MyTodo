import { describe, expect, it } from "vitest";
import { resolveHabitIcon } from "./resolve-icon.js";

describe("resolveHabitIcon", () => {
  it("keeps explicit icon from habit", () => {
    expect(resolveHabitIcon({ icon: "🎯" })).toBe("🎯");
  });

  it("resolves template icons", () => {
    expect(resolveHabitIcon({ template_id: "running" })).toBe("🏃");
    expect(resolveHabitIcon({ template_id: "books" })).toBe("/habits/light/books.png");
  });

  it("resolves category icons for custom habits", () => {
    expect(
      resolveHabitIcon({
        category_key: "walking",
        name: "Ходьба на свежем воздухе",
      }),
    ).toBe("🚶");
    expect(
      resolveHabitIcon({
        category_key: "language",
        name: "Иностранный язык",
      }),
    ).toBe("🗣️");
    expect(
      resolveHabitIcon({
        category_key: "healthy_nutrition",
        name: "Правильное питание",
      }),
    ).toBe("🥗");
  });

  it("falls back to habit name when category is missing", () => {
    expect(resolveHabitIcon({ name: "Программирование" })).toBe("💻");
  });
});
