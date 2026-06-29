import { ENGLISH_CATALOG_DURATION_PLACEHOLDER_MAX_SEC, ENGLISH_COURSE_TITLE, ENGLISH_WATCH_THRESHOLD } from "@mytodo/shared";

export type VkVideoRef = {
  oid: string;
  id: string;
};

export function formatEnglishLessonLabel(dayNumber: number): string {
  return `Урок ${dayNumber} - ${ENGLISH_COURSE_TITLE}`;
}

/** Parses VK / VK Video page or embed URLs. */
export function parseVkVideoRef(url: string): VkVideoRef | null {
  const VK_VIDEO_REF_PATTERN = /video(-?\d+)_(\d+)/;

  try {
    const trimmed = url.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isVkHost =
      host.includes("vk.com") ||
      host.includes("vkvideo.ru") ||
      host === "vk.ru" ||
      host.endsWith(".vk.ru");

    if (!isVkHost) {
      const fromText = trimmed.match(VK_VIDEO_REF_PATTERN);
      return fromText ? { oid: fromText[1], id: fromText[2] } : null;
    }

    const fromPath = parsed.pathname.match(VK_VIDEO_REF_PATTERN);
    if (fromPath) {
      return { oid: fromPath[1], id: fromPath[2] };
    }

    const zParam = parsed.searchParams.get("z");
    if (zParam) {
      const fromZ = zParam.match(VK_VIDEO_REF_PATTERN);
      if (fromZ) {
        return { oid: fromZ[1], id: fromZ[2] };
      }
    }

    if (parsed.pathname.includes("video_ext.php")) {
      const oid = parsed.searchParams.get("oid");
      const id = parsed.searchParams.get("id");
      if (oid && id) {
        return { oid, id };
      }
    }

    const fromHref = trimmed.match(VK_VIDEO_REF_PATTERN);
    if (fromHref) {
      return { oid: fromHref[1], id: fromHref[2] };
    }

    return null;
  } catch {
    const fromPlain = url.trim().match(/video(-?\d+)_(\d+)/);
    return fromPlain ? { oid: fromPlain[1], id: fromPlain[2] } : null;
  }
}

export function buildVkEmbedUrl(video: VkVideoRef): string {
  const params = new URLSearchParams({
    oid: video.oid,
    id: video.id,
    hd: "2",
    js_api: "1",
  });
  return `https://vk.com/video_ext.php?${params.toString()}`;
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

/** Catalog entries from fast VK import use 1s until the player reports real duration. */
export const CATALOG_DURATION_PLACEHOLDER_MAX_SEC = ENGLISH_CATALOG_DURATION_PLACEHOLDER_MAX_SEC;

export function isCatalogDurationPlaceholder(catalogDurationSec: number): boolean {
  return catalogDurationSec <= CATALOG_DURATION_PLACEHOLDER_MAX_SEC;
}

export function resolveDisplayLessonDuration(
  catalogDurationSec: number,
  playerDurationSec: number | null,
): number | null {
  if (playerDurationSec != null && playerDurationSec > CATALOG_DURATION_PLACEHOLDER_MAX_SEC) {
    return playerDurationSec;
  }
  if (!isCatalogDurationPlaceholder(catalogDurationSec)) {
    return catalogDurationSec;
  }
  return null;
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
  if (
    isCatalogDurationPlaceholder(lessonDurationSec) &&
    (playerDurationSec == null || playerDurationSec <= CATALOG_DURATION_PLACEHOLDER_MAX_SEC)
  ) {
    return { requiredWatchSec: 0, apiMinimumSec: 0 };
  }

  const effectiveDuration = resolveEnglishLessonDuration(lessonDurationSec, playerDurationSec);
  const apiMinimumSec = Math.ceil(effectiveDuration * ENGLISH_WATCH_THRESHOLD);
  const requiredWatchSec = Math.min(playerDurationSec ?? effectiveDuration, apiMinimumSec);
  return { requiredWatchSec, apiMinimumSec };
}

export function resolveEnglishLessonDuration(
  catalogDurationSec: number,
  playerDurationSec: number | null,
): number {
  if (playerDurationSec != null && playerDurationSec > CATALOG_DURATION_PLACEHOLDER_MAX_SEC) {
    return playerDurationSec;
  }
  if (!isCatalogDurationPlaceholder(catalogDurationSec)) {
    return catalogDurationSec;
  }
  return 0;
}

export function resolveEnglishCompleteWatchSec(
  watchedSec: number,
  lessonDurationSec: number,
): number {
  if (lessonDurationSec <= 0) {
    return watchedSec;
  }
  return Math.max(watchedSec, Math.ceil(lessonDurationSec * ENGLISH_WATCH_THRESHOLD));
}

/** True when the player reported the video has finished. */
export function canAutoCompleteEnglishLesson(
  watchedSec: number,
  lessonDurationSec: number,
): boolean {
  if (lessonDurationSec <= CATALOG_DURATION_PLACEHOLDER_MAX_SEC) {
    return false;
  }
  const apiMinimumSec = Math.ceil(lessonDurationSec * ENGLISH_WATCH_THRESHOLD);
  return watchedSec >= apiMinimumSec - 1;
}

/**
 * Maps video watch time to habit goal minutes on the daily plan bar.
 * A fully watched video always credits the full goal (e.g. 23 min video → 25/25).
 * Longer videos credit the goal only after the entire video is watched.
 */
export function resolveEnglishHabitGoalMinutes(
  watchedSec: number,
  lessonDurationSec: number,
  goalMinutes: number,
  isLessonComplete: boolean,
): number {
  if (goalMinutes <= 0) {
    return 0;
  }

  if (isLessonComplete) {
    return goalMinutes;
  }

  if (
    lessonDurationSec > CATALOG_DURATION_PLACEHOLDER_MAX_SEC &&
    watchedSec >= lessonDurationSec - 1
  ) {
    return goalMinutes;
  }

  return Math.min(Math.ceil(watchedSec / 60), goalMinutes);
}

export function shortenLessonTitle(title: string, maxLength = 72): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}
