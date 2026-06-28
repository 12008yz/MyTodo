import { minutesToExpectedYield } from "@mytodo/domain";
import type { DailyPlanBlock } from "@mytodo/shared";

type CompletionHabit = {
  side: "light" | "dark";
  type: "target" | "limit" | "abstinence";
};

export function needsCompletionValuePrompt(
  habit: CompletionHabit,
  block: DailyPlanBlock,
  endedEarly: boolean,
): boolean {
  if (block.unit === "minutes" || block.unit === "seconds") {
    return false;
  }

  if (endedEarly) {
    return habit.side === "dark" && habit.type === "limit";
  }

  return true;
}

export function resolveEarlyCompletionValue(
  block: DailyPlanBlock,
  plannedMin: number,
): number {
  if (block.unit === "minutes") {
    return plannedMin;
  }

  if (block.unit === "seconds" && block.expected_yield > 0) {
    return block.expected_yield;
  }

  if (block.expected_yield > 0) {
    return block.expected_yield;
  }

  return minutesToExpectedYield(block.unit, plannedMin);
}

export function resolveNaturalSecondsCompletionValue(
  block: DailyPlanBlock,
  plannedSeconds: number | null,
  elapsedSeconds: number,
): number {
  return Math.max(
    1,
    plannedSeconds ??
      (block.expected_yield > 0 ? block.expected_yield : elapsedSeconds),
  );
}
