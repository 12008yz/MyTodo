import { describe, expect, it } from "vitest";
import { needsCompletionValuePrompt, resolveEarlyCompletionValue } from "./sessionCompletion";

const baseBlock = {
  id: "block-1",
  habit_id: "habit-1",
  habit_name: "Test",
  icon: null,
  order: 0,
  status: "pending" as const,
  actual_value: null,
  actual_minutes: null,
};

const lightTargetHabit = { side: "light" as const, type: "target" as const };
const darkLimitHabit = { side: "dark" as const, type: "limit" as const };

describe("needsCompletionValuePrompt", () => {
  it("never prompts for minute habits", () => {
    const block = {
      ...baseBlock,
      unit: "minutes" as const,
      duration_min: 25,
      expected_yield: 25,
    };

    expect(needsCompletionValuePrompt(lightTargetHabit, block, true)).toBe(false);
    expect(needsCompletionValuePrompt(darkLimitHabit, block, false)).toBe(false);
  });

  it("prompts on natural finish for page habits", () => {
    expect(
      needsCompletionValuePrompt(
        lightTargetHabit,
        {
          ...baseBlock,
          unit: "pages",
          duration_min: 10,
          expected_yield: 5,
        },
        false,
      ),
    ).toBe(true);
  });

  it("auto-completes light page habits when ended early", () => {
    expect(
      needsCompletionValuePrompt(
        lightTargetHabit,
        {
          ...baseBlock,
          unit: "pages",
          duration_min: 10,
          expected_yield: 5,
        },
        true,
      ),
    ).toBe(false);
  });

  it("never prompts for second-based habits", () => {
    expect(
      needsCompletionValuePrompt(
        lightTargetHabit,
        {
          ...baseBlock,
          unit: "seconds",
          duration_min: 1,
          expected_yield: 35,
        },
        false,
      ),
    ).toBe(false);
  });

  it("still prompts for dark limit habits when ended early", () => {
    expect(
      needsCompletionValuePrompt(
        darkLimitHabit,
        {
          ...baseBlock,
          unit: "cigarettes",
          duration_min: 5,
          expected_yield: 0,
        },
        true,
      ),
    ).toBe(true);
  });
});

describe("resolveEarlyCompletionValue", () => {
  it("credits planned session minutes for minute habits", () => {
    expect(
      resolveEarlyCompletionValue(
        {
          ...baseBlock,
          unit: "minutes",
          duration_min: 10,
          expected_yield: 10,
        },
        25,
      ),
    ).toBe(25);
  });

  it("credits expected yield for page habits", () => {
    expect(
      resolveEarlyCompletionValue(
        {
          ...baseBlock,
          unit: "pages",
          duration_min: 10,
          expected_yield: 5,
        },
        10,
      ),
    ).toBe(5);
  });
});
