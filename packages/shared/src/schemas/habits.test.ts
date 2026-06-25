import { describe, expect, it } from "vitest";
import { createHabitRequestSchema, habitResponseSchema } from "./habits.js";

describe("createHabitRequestSchema", () => {
  it("accepts category_key for custom habits", () => {
    const result = createHabitRequestSchema.safeParse({
      name: "Медитация",
      unit: "minutes",
      baseline_value: 1,
      category_key: "meditation",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected custom habit payload to parse");
    }
    expect("category_key" in result.data ? result.data.category_key : undefined).toBe("meditation");
  });
});

describe("habitResponseSchema", () => {
  it("parses habit response with category_key", () => {
    const result = habitResponseSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      name: "Медитация",
      type: "target",
      side: "light",
      unit: "minutes",
      baseline_value: 1,
      current_goal: 2,
      growth_step: 1,
      progression_direction: "increase",
      phase: "reduction",
      last_relapse_at: null,
      allows_weekly_skip: true,
      is_custom: true,
      icon: null,
      is_active: true,
      template_id: null,
      category_key: "meditation",
      harshness_level: 1,
      created_at: "2026-06-25T09:00:00.000Z",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected habit response payload to parse");
    }
    expect(result.data.category_key).toBe("meditation");
  });
});
