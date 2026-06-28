import catalog from "./english-lessons.json" with { type: "json" };

export type EnglishLessonSeed = {
  dayNumber: number;
  title: string;
  videoUrl: string;
  durationSec: number;
  description: string | null;
};

export const ENGLISH_LESSON_CATALOG = catalog as EnglishLessonSeed[];
export const ENGLISH_LESSON_COUNT = ENGLISH_LESSON_CATALOG.length;

export function getEnglishLessonByDay(dayNumber: number): EnglishLessonSeed | undefined {
  return ENGLISH_LESSON_CATALOG.find((lesson) => lesson.dayNumber === dayNumber);
}

/** Stable UUID for demo / client-side lesson references. */
export function englishLessonSeedId(dayNumber: number): string {
  return `00000000-0000-4000-8000-${String(dayNumber).padStart(12, "0")}`;
}

export function seedToEnglishLessonResponse(seed: EnglishLessonSeed, id?: string) {
  return {
    id: id ?? englishLessonSeedId(seed.dayNumber),
    day_number: seed.dayNumber,
    title: seed.title,
    video_url: seed.videoUrl,
    duration_sec: seed.durationSec,
    description: seed.description,
  };
}
