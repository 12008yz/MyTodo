import type { Habit } from "../db/schema/index.js";
import { SOCIAL_MEDIA_MIN_GOAL } from "@mytodo/shared";
import type { DayStatus, HabitForProgression } from "@mytodo/domain";

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

export function previewStatusFromCheckin(status: string | undefined): DayStatus {
  if (status === "success" || status === "fail" || status === "skipped") {
    return status;
  }

  if (status === "pending") {
    return "fail";
  }

  // No checkin yet — show optimistic preview ("goal tomorrow on success").
  return "success";
}
