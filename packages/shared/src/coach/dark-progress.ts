export type DarkReductionDot = "done" | "current" | "pending";

export function darkReductionDots(
  successDaysAtGoal: number,
  intervalDays: number,
  todaySuccess: boolean,
): DarkReductionDot[] {
  const interval = Math.max(1, intervalDays);
  const filled = Math.min(interval, successDaysAtGoal + (todaySuccess ? 1 : 0));

  return Array.from({ length: interval }, (_, index) => {
    if (index < filled) return "done";
    if (index === filled && filled < interval) return "current";
    return "pending";
  });
}

export function formatDarkReductionProgressLabel(
  successDaysAtGoal: number,
  intervalDays: number,
  todaySuccess: boolean,
): string {
  const interval = Math.max(1, intervalDays);
  const done = Math.min(interval, successDaysAtGoal + (todaySuccess ? 1 : 0));
  if (done >= interval) {
    return "Завтра лимит снизится";
  }
  const remaining = interval - done;
  if (remaining === 1) {
    return `${done} из ${interval} дней до снижения · остался 1 день`;
  }
  return `${done} из ${interval} дней до снижения`;
}

export function formatGoalReducedPushBody(
  nextGoal: number,
  unitLabel: string,
  harshnessLevel: 1 | 2 | 3,
): string {
  const goalPart = `Лимит снижен до ${nextGoal} ${unitLabel}.`.trim();
  const suffix: Record<1 | 2 | 3, string> = {
    1: "Ты становишься свободнее!",
    2: "Три дня выдержал. Так держать.",
    3: "Норматив выполнен. Лимит ниже. Продолжаем.",
  };
  return `Отлично! Ты продержался 3 дня. ${goalPart} ${suffix[harshnessLevel]}`;
}
