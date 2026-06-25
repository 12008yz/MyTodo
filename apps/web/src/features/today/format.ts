import type { DailyPlanBlock, HabitUnit, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";

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
      return "В процессе";
  }
}

function formatStreakDays(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  let word = "дней";
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = "день";
    else if (mod10 >= 2 && mod10 <= 4) word = "дня";
  }
  return `${days} ${word} подряд`;
}

type CardHint = {
  text: string;
  variant: "success" | "hint";
};

export function formatCardHint(params: {
  habit: TodayLightHabit | TodayDarkHabit;
  block: DailyPlanBlock | null;
  goalReached: boolean;
  resumeSession: boolean;
  hasActiveFocus: boolean;
}): CardHint | null {
  const { habit, block, goalReached, resumeSession, hasActiveFocus } = params;

  if (goalReached) {
    return {
      text: `Цель выполнена · завтра: ${habit.preview_next_goal} ${formatUnit(habit.unit)}`,
      variant: "success",
    };
  }

  if (resumeSession && !hasActiveFocus) {
    return {
      text: "Сессия на паузе — нажмите «Продолжить»",
      variant: "hint",
    };
  }

  if (habit.streak_days >= 2) {
    return {
      text: `Серия: ${formatStreakDays(habit.streak_days)}`,
      variant: "hint",
    };
  }

  if (block && block.unit !== "minutes" && block.expected_yield > 0) {
    return {
      text: `Сессия: ~${block.expected_yield} ${formatUnit(block.unit)}`,
      variant: "hint",
    };
  }

  return null;
}
