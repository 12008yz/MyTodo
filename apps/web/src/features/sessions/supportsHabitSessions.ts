import {
  type HabitCategoryKey,
  isNonSessionLightCategory,
  isStrengthWorkoutHabit,
} from "@mytodo/shared";

type HabitSessionRef = {
  side: "light" | "dark";
  type: "target" | "limit" | "abstinence";
  template_id?: string | null;
  category_key?: HabitCategoryKey | null;
  name?: string | null;
};

/** Matches API `HabitSessionService.getSupportedHabit` rules. */
export function supportsHabitSessions(habit: HabitSessionRef): boolean {
  if (habit.type === "abstinence") {
    return false;
  }

  if (isNonSessionLightCategory(habit.category_key)) {
    return false;
  }

  if (isStrengthWorkoutHabit(habit)) {
    return false;
  }

  if (habit.side === "light") {
    return true;
  }

  return habit.type === "limit" && habit.template_id !== "social_media";
}
