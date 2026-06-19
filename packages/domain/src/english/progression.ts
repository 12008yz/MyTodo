export type EnglishDayStatus = "success" | "fail" | "skipped";

export function computeNextEnglishDay(currentDay: number, dayStatus: EnglishDayStatus): number {
  if (dayStatus === "success") {
    return currentDay + 1;
  }

  return currentDay;
}
