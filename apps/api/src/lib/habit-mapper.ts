import type { Habit } from "../db/schema/index.js";
import type { HabitResponse, HabitTemplateId, HabitUnit } from "@mytodo/shared";

function toNumber(value: string): number {
  return Number(value);
}

export function toHabitResponse(habit: Habit): HabitResponse {
  return {
    id: habit.id,
    user_id: habit.userId,
    name: habit.name,
    type: habit.type as HabitResponse["type"],
    side: habit.side as HabitResponse["side"],
    unit: (habit.unit as HabitUnit | null) ?? null,
    baseline_value: toNumber(habit.baselineValue),
    current_goal: toNumber(habit.currentGoal),
    growth_step: toNumber(habit.growthStep),
    progression_direction: habit.progressionDirection as HabitResponse["progression_direction"],
    phase: habit.phase as HabitResponse["phase"],
    last_relapse_at: habit.lastRelapseAt?.toISOString() ?? null,
    allows_weekly_skip: habit.allowsWeeklySkip,
    is_custom: habit.isCustom,
    icon: habit.icon,
    is_active: habit.isActive,
    template_id: (habit.templateId as HabitTemplateId | null) ?? null,
    harshness_level: habit.harshnessLevel,
    created_at: habit.createdAt.toISOString(),
  };
}
