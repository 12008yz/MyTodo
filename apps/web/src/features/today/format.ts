import type { HabitUnit, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";

const UNIT_LABELS: Record<HabitUnit, string> = {
  pages: "стр.",
  minutes: "мин",
  reps: "повт.",
  seconds: "сек",
  cigarettes: "сиг.",
  spoons: "лож.",
  pieces: "шт.",
  lessons: "урок.",
};

export function formatUnit(unit: HabitUnit | null): string {
  if (!unit) return "";
  return UNIT_LABELS[unit] ?? unit;
}

export function formatGoalLabel(habit: TodayLightHabit | TodayDarkHabit): string {
  const unit = formatUnit(habit.unit);
  const goal = habit.current_goal;

  if (habit.type === "limit") {
    return `лимит: ≤ ${goal} ${unit}`.trim();
  }

  if (habit.type === "abstinence") {
    return "полный отказ";
  }

  return `цель: ${goal} ${unit}`.trim();
}

export function formatTimer(elapsed: { days: number; hours: number; minutes: number }): string {
  const parts: string[] = [];
  if (elapsed.days > 0) parts.push(`${elapsed.days} д`);
  parts.push(`${elapsed.hours} ч`);
  parts.push(`${elapsed.minutes} мин`);
  return parts.join(" ");
}

export function priorityFromStatus(
  status: "success" | "fail" | "pending" | "skipped" | undefined,
): "low" | "medium" | "high" {
  if (status === "success") return "low";
  if (status === "fail") return "high";
  return "medium";
}

export function statusLabel(
  status: "success" | "fail" | "pending" | "skipped" | undefined,
  habitType?: "target" | "limit" | "abstinence",
): string {
  switch (status) {
    case "success":
      return "Выполнено";
    case "fail":
      return habitType === "target" ? "Не выполнено" : "Срыв";
    case "skipped":
      return "Пропуск";
    default:
      return habitType === "abstinence" ? "Держишься" : "Можно начать";
  }
}
