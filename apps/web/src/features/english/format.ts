import { ENGLISH_COURSE_TITLE, ENGLISH_WATCH_THRESHOLD } from "@mytodo/shared";

export function formatEnglishLessonLabel(dayNumber: number): string {
  return `Урок ${dayNumber} - ${ENGLISH_COURSE_TITLE}`;
}

export function parseYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    const fromQuery = parsed.searchParams.get("v");
    if (fromQuery) {
      return fromQuery;
    }
    const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
    return embedMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

export function formatLessonDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) {
    return `${seconds} сек`;
  }
  if (seconds === 0) {
    return `${minutes} мин`;
  }
  return `${minutes} мин ${seconds} сек`;
}

export function formatWatchProgress(watchedSec: number, requiredSec: number): number {
  if (requiredSec <= 0) {
    return 0;
  }
  if (watchedSec >= requiredSec - 1) {
    return 100;
  }
  return Math.min(100, Math.round((watchedSec / requiredSec) * 100));
}

export function resolveEnglishWatchRequirement(
  lessonDurationSec: number,
  playerDurationSec: number | null,
): { requiredWatchSec: number; apiMinimumSec: number } {
  const apiMinimumSec = Math.ceil(lessonDurationSec * ENGLISH_WATCH_THRESHOLD);
  const requiredWatchSec =
    playerDurationSec != null ? Math.min(playerDurationSec, apiMinimumSec) : apiMinimumSec;
  return { requiredWatchSec, apiMinimumSec };
}

export function resolveEnglishCompleteWatchSec(
  watchedSec: number,
  lessonDurationSec: number,
): number {
  return Math.max(watchedSec, Math.ceil(lessonDurationSec * ENGLISH_WATCH_THRESHOLD));
}

/** True when the iframe reported the video has finished. */
export function canAutoCompleteEnglishLesson(
  watchedSec: number,
  lessonDurationSec: number,
): boolean {
  const apiMinimumSec = Math.ceil(lessonDurationSec * ENGLISH_WATCH_THRESHOLD);
  return watchedSec >= apiMinimumSec - 1;
}

export function shortenLessonTitle(title: string, maxLength = 72): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}
