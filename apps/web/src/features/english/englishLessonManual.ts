const STORAGE_PREFIX = "english-manual:";

function storageKey(planDate: string, lessonId: string): string {
  return `${STORAGE_PREFIX}${planDate}:${lessonId}`;
}

export function readEnglishLessonManualMinutes(planDate: string, lessonId: string): number {
  try {
    const raw = sessionStorage.getItem(storageKey(planDate, lessonId));
    if (raw == null) {
      return 0;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

export function writeEnglishLessonManualMinutes(
  planDate: string,
  lessonId: string,
  minutes: number,
): void {
  try {
    const key = storageKey(planDate, lessonId);
    if (minutes <= 0) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, String(Math.floor(minutes)));
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function clearEnglishLessonManualMinutes(planDate: string, lessonId: string): void {
  writeEnglishLessonManualMinutes(planDate, lessonId, 0);
}

/** Card bar: video progress plus manual minutes for this lesson, capped at the daily goal. */
export function resolveEnglishCardMinutes(
  videoMinutes: number,
  manualMinutes: number,
  goalMinutes: number,
): number {
  if (goalMinutes <= 0) {
    return 0;
  }
  return Math.min(goalMinutes, videoMinutes + manualMinutes);
}
