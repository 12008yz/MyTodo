import type { HarshnessLevel } from "./coach-messages.js";

export const DOOM_SCROLL_WARNING_BEFORE_MIN = 5;

export const DOOM_SCROLL_PLATFORMS = [
  "tiktok",
  "youtube_shorts",
  "instagram_reels",
  "youtube",
  "other",
] as const;

export type DoomScrollPlatform = (typeof DOOM_SCROLL_PLATFORMS)[number];

export const DOOM_SCROLL_PLATFORM_LABELS: Record<DoomScrollPlatform, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  instagram_reels: "Reels",
  youtube: "YouTube",
  other: "Другое",
};

function pluralMinutes(min: number): string {
  const mod10 = min % 10;
  const mod100 = min % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${min} минут`;
  if (mod10 === 1) return `${min} минута`;
  if (mod10 >= 2 && mod10 <= 4) return `${min} минуты`;
  return `${min} минут`;
}

export function resolveDoomScrollStartMessage(
  durationMin: number,
  harshness: HarshnessLevel,
): string {
  const duration = pluralMinutes(durationMin);
  if (harshness === 3) {
    return `Таймер на ${duration}. По окончании — отбой. Контролируй себя.`;
  }
  return `${duration}. Потом — стоп.`;
}

const WARNING_BY_PLATFORM: Record<DoomScrollPlatform, Record<HarshnessLevel, string>> = {
  tiktok: {
    1: "Осталось 5 минут. Досмотри одно и закрой TikTok.",
    2: "5 минут до стопа. Выйди из TikTok.",
    3: "5 минут. Заканчивай с TikTok.",
  },
  youtube_shorts: {
    1: "Осталось 5 минут. Досмотри одно и закрой Shorts.",
    2: "5 минут до стопа. Выйди из Shorts.",
    3: "5 минут. Заканчивай с YouTube Shorts.",
  },
  instagram_reels: {
    1: "Осталось 5 минут. Досмотри одно и закрой Reels.",
    2: "5 минут до стопа. Выйди из Reels.",
    3: "5 минут. Заканчивай с Reels.",
  },
  youtube: {
    1: "Осталось 5 минут. Досмотри ролик и закрой YouTube.",
    2: "5 минут до стопа. Выйди из YouTube.",
    3: "5 минут. Заканчивай с YouTube.",
  },
  other: {
    1: "Осталось 5 минут. Пора готовиться выходить из ленты.",
    2: "5 минут до стопа. Сверни ленту.",
    3: "5 минут. Заканчивай просмотр.",
  },
};

const END_BY_PLATFORM: Record<DoomScrollPlatform, Record<HarshnessLevel, string>> = {
  tiktok: {
    1: "Время вышло. Закрой TikTok.",
    2: "Время вышло. Закрой TikTok.",
    3: "Время вышло. TikTok — стоп. Отложи телефон.",
  },
  youtube_shorts: {
    1: "Время вышло. Закрой YouTube Shorts.",
    2: "Время вышло. Закрой Shorts.",
    3: "Время вышло. Shorts — стоп. Отложи телефон.",
  },
  instagram_reels: {
    1: "Время вышло. Закрой Reels.",
    2: "Время вышло. Закрой Reels.",
    3: "Время вышло. Reels — стоп. Отложи телефон.",
  },
  youtube: {
    1: "Время вышло. Закрой YouTube.",
    2: "Время вышло. Закрой YouTube.",
    3: "Время вышло. YouTube — стоп. Отложи телефон.",
  },
  other: {
    1: "Время вышло. Отложи телефон.",
    2: "Время вышло. Отложи телефон.",
    3: "Время вышло. Отложи телефон.",
  },
};

export function resolveDoomScrollWarningMessage(
  platform: DoomScrollPlatform | null | undefined,
  harshness: HarshnessLevel,
): string {
  const key = platform ?? "other";
  return WARNING_BY_PLATFORM[key][harshness];
}

export function resolveDoomScrollEndMessage(
  platform: DoomScrollPlatform | null | undefined,
  harshness: HarshnessLevel,
): string {
  const key = platform ?? "other";
  return END_BY_PLATFORM[key][harshness];
}

export function formatSocialMediaRemainingMinutes(consumed: number, limit: number): string {
  const remaining = limit - Math.floor(consumed);
  if (remaining <= 0) {
    return "лимит на сегодня исчерпан";
  }
  return `осталось ${pluralMinutes(remaining)} на сегодня`;
}
