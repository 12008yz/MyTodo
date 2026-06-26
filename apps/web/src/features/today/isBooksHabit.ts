import type { TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";

export function isBooksHabit(habit: TodayLightHabit | TodayDarkHabit): boolean {
  return habit.template_id === "books";
}
