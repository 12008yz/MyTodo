import { computeNextEnglishDay, type EnglishDayStatus } from "./progression.js";

export type EnglishProgressToday = {
  status: string;
};

/** Final day status for worker close — pending / missing → fail (§7.3, §8.3). */
export function resolveEnglishDayStatus(status?: string | null): EnglishDayStatus {
  if (status === "success" || status === "skipped" || status === "fail") {
    return status;
  }

  return "fail";
}

export function closeEnglishDay(
  currentDay: number,
  progressToday?: EnglishProgressToday | null,
): { status: EnglishDayStatus; nextDay: number } {
  const status = resolveEnglishDayStatus(progressToday?.status);

  return {
    status,
    nextDay: computeNextEnglishDay(currentDay, status),
  };
}
