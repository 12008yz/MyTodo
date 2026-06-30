import { describe, expect, it } from "vitest";
import {
  formatProgressDayHabitDetail,
  progressDayStatusSymbol,
  type ProgressCalendarHabit,
} from "./formatProgressDayHabit";

function habit(overrides: Partial<ProgressCalendarHabit> = {}): ProgressCalendarHabit {
  return {
    habit_id: "00000000-0000-4000-8000-000000000001",
    name: "Тест",
    side: "dark",
    type: "limit",
    phase: "reduction",
    unit: "cigarettes",
    template_id: null,
    status: "success",
    value: 12,
    goal: 18,
    minutes_total: 0,
    ...overrides,
  };
}

describe("formatProgressDayHabitDetail", () => {
  it("formats limit habit value and goal", () => {
    expect(formatProgressDayHabitDetail(habit())).toBe("12 / 18 сиг.");
  });

  it("formats abstinence success and fail", () => {
    expect(
      formatProgressDayHabitDetail(
        habit({ type: "abstinence", phase: "abstinence", status: "success", value: null, goal: null }),
      ),
    ).toBe("День без срыва");
    expect(
      formatProgressDayHabitDetail(
        habit({ type: "abstinence", phase: "abstinence", status: "fail", value: null, goal: null }),
      ),
    ).toBe("Сорвался");
  });

  it("formats social media minutes", () => {
    expect(
      formatProgressDayHabitDetail(
        habit({
          template_id: "social_media",
          unit: "minutes",
          value: 8,
          goal: 30,
          minutes_total: 8,
        }),
      ),
    ).toBe("8 / 30 мин");
  });

  it("formats smoking in abstinence phase as abstinence detail", () => {
    expect(
      formatProgressDayHabitDetail(
        habit({
          type: "limit",
          phase: "abstinence",
          unit: "cigarettes",
          status: "success",
          value: null,
          goal: 0,
        }),
      ),
    ).toBe("День без срыва");
  });

  it("shows pending limit hint when value is missing", () => {
    expect(
      formatProgressDayHabitDetail(
        habit({ status: "pending", value: null, goal: 18 }),
      ),
    ).toBe("лимит ≤ 18 сиг.");
  });

  it("formats light target habit", () => {
    expect(
      formatProgressDayHabitDetail(
        habit({
          side: "light",
          type: "target",
          unit: "minutes",
          value: 25,
          goal: 30,
        }),
      ),
    ).toBe("25 / 30 мин");
  });
});

describe("progressDayStatusSymbol", () => {
  it("maps statuses to symbols", () => {
    expect(progressDayStatusSymbol("success")).toBe("✓");
    expect(progressDayStatusSymbol("fail")).toBe("✗");
    expect(progressDayStatusSymbol("skipped")).toBe("—");
    expect(progressDayStatusSymbol("pending")).toBe("…");
  });
});
