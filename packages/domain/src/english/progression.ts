export type EnglishDayStatus = "success" | "fail" | "skipped";

export function computeNextEnglishDay(currentDay: number, dayStatus: EnglishDayStatus): number {
  if (dayStatus === "success") {
    return currentDay + 1;
  }

  return currentDay;
}

export function computeEnglishPreviewNextDay(
  currentDay: number,
  lessonDayNumber: number,
  dayStatus: EnglishDayStatus | null,
): number {
  const baseDay = lessonDayNumber !== currentDay ? lessonDayNumber : currentDay;

  if (dayStatus === "success" || dayStatus === "fail" || dayStatus === "skipped") {
    return computeNextEnglishDay(baseDay, dayStatus);
  }

  return baseDay;
}
