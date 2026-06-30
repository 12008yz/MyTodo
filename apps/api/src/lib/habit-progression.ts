import type { Habit } from "../db/schema/index.js";
import { SOCIAL_MEDIA_MIN_GOAL } from "@mytodo/shared";
import type { DayStatus, HabitForProgression } from "@mytodo/domain";
import { previewDayStatusForProgression } from "@mytodo/domain";

export function toProgressionHabit(habit: Habit): HabitForProgression {
  return {
    type: habit.type as HabitForProgression["type"],
    side: habit.side as HabitForProgression["side"],
    currentGoal: Number(habit.currentGoal),
    growthStep: Number(habit.growthStep),
    progressionDirection: habit.progressionDirection as HabitForProgression["progressionDirection"],
    progressionIntervalDays: habit.progressionIntervalDays,
    successDaysAtGoal: habit.successDaysAtGoal,
    categoryKey: habit.categoryKey,
    name: habit.name,
    baselineValue: Number(habit.baselineValue),
    minGoal: habit.templateId === "social_media" ? SOCIAL_MEDIA_MIN_GOAL : undefined,
  };
}

export function previewStatusFromCheckin(
  status: string | undefined,
  habit?: Pick<HabitForProgression, "type" | "side" | "currentGoal">,
  value?: number | null,
): DayStatus {
  if (!habit) {
    if (status === "success" || status === "fail" || status === "skipped") {
      return status;
    }
    if (status === "pending") {
      return "fail";
    }
    return "success";
  }

  return previewDayStatusForProgression(
    {
      type: habit.type,
      side: habit.side,
      currentGoal: habit.currentGoal,
    },
    status,
    value,
  );
}
