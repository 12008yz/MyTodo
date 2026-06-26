import type { Habit } from "../db/schema/index.js";
import {
  resolveHabitDisplayName,
  resolveHabitIcon,
  type HabitCategoryKey,
  type HabitResponse,
  type HabitSide,
  type HabitTemplateId,
  type HabitUnit,
} from "@mytodo/shared";

function toNumber(value: string): number {
  return Number(value);
}

export function toHabitResponse(habit: Habit): HabitResponse {
  const templateId = (habit.templateId as HabitTemplateId | null) ?? null;
  const name = resolveHabitDisplayName({
    name: habit.name,
    template_id: templateId,
    is_custom: habit.isCustom,
  });

  return {
    id: habit.id,
    user_id: habit.userId,
    name,
    type: habit.type as HabitResponse["type"],
    side: habit.side as HabitResponse["side"],
    unit: (habit.unit as HabitUnit | null) ?? null,
    baseline_value: toNumber(habit.baselineValue),
    current_goal: toNumber(habit.currentGoal),
    growth_step: toNumber(habit.growthStep),
    progression_interval_days: habit.progressionIntervalDays,
    success_days_at_goal: habit.successDaysAtGoal,
    progression_direction: habit.progressionDirection as HabitResponse["progression_direction"],
    phase: habit.phase as HabitResponse["phase"],
    last_relapse_at: habit.lastRelapseAt?.toISOString() ?? null,
    allows_weekly_skip: habit.allowsWeeklySkip,
    is_custom: habit.isCustom,
    icon: resolveHabitIcon({
      icon: habit.icon,
      template_id: templateId,
      category_key: (habit.categoryKey as HabitCategoryKey | null) ?? null,
      name,
      side: habit.side as HabitSide,
    }),
    is_active: habit.isActive,
    template_id: templateId,
    category_key: (habit.categoryKey as HabitCategoryKey | null) ?? null,
    harshness_level: habit.harshnessLevel,
    created_at: habit.createdAt.toISOString(),
  };
}
