import { z } from "zod";

export const ENGLISH_PROGRESS_STATUSES = ["success", "fail", "pending", "skipped"] as const;
export type EnglishProgressStatus = (typeof ENGLISH_PROGRESS_STATUSES)[number];

export const ENGLISH_WATCH_THRESHOLD = 1;

/** Catalog entries imported from VK use 1s until the player reports real duration. */
export const ENGLISH_CATALOG_DURATION_PLACEHOLDER_MAX_SEC = 60;

export function resolveEnglishMinimumWatchSec(
  catalogDurationSec: number,
  watchedSec: number,
): number {
  if (catalogDurationSec <= ENGLISH_CATALOG_DURATION_PLACEHOLDER_MAX_SEC) {
    return Math.max(60, Math.ceil(watchedSec * ENGLISH_WATCH_THRESHOLD) - 1);
  }
  return Math.ceil(catalogDurationSec * ENGLISH_WATCH_THRESHOLD);
}

export const ENGLISH_COURSE_TITLE = "С 0 до совершенства";

export const englishLessonSchema = z.object({
  id: z.string().uuid(),
  day_number: z.number().int().positive(),
  title: z.string(),
  video_url: z.string().url(),
  duration_sec: z.number().int().positive(),
  description: z.string().nullable(),
});

export type EnglishLessonResponse = z.infer<typeof englishLessonSchema>;

export const englishTodayEnabledSchema = z.object({
  enabled: z.literal(true),
  current_day: z.number().int().positive(),
  lesson: englishLessonSchema,
  selected_lesson_id: z.string().uuid().nullable(),
  day_status: z.enum(ENGLISH_PROGRESS_STATUSES).nullable(),
  watched_sec: z.number().int().min(0),
  preview_next_day: z.number().int().positive(),
});

export const englishTodayDisabledSchema = z.object({
  enabled: z.literal(false),
});

export const englishTodayResponseSchema = z.discriminatedUnion("enabled", [
  englishTodayEnabledSchema,
  englishTodayDisabledSchema,
]);

export type EnglishTodayResponse = z.infer<typeof englishTodayResponseSchema>;

export const englishWatchRequestSchema = z.object({
  watched_sec: z.number().int().min(0),
});

export type EnglishWatchRequest = z.infer<typeof englishWatchRequestSchema>;

export const englishWatchResponseSchema = z.object({
  lesson_id: z.string().uuid(),
  watched_sec: z.number().int().min(0),
});

export type EnglishWatchResponse = z.infer<typeof englishWatchResponseSchema>;

export const englishSelectLessonRequestSchema = z.object({
  lesson_id: z.string().uuid(),
});

export type EnglishSelectLessonRequest = z.infer<typeof englishSelectLessonRequestSchema>;

export const englishSelectLessonResponseSchema = z.object({
  selected_lesson_id: z.string().uuid(),
  lesson: englishLessonSchema,
  current_day: z.number().int().positive(),
  day_status: z.enum(ENGLISH_PROGRESS_STATUSES).nullable(),
  watched_sec: z.number().int().min(0),
  preview_next_day: z.number().int().positive(),
  habit_complete: z.boolean(),
});

export type EnglishSelectLessonResponse = z.infer<typeof englishSelectLessonResponseSchema>;

export const englishCatalogItemSchema = englishLessonSchema.extend({
  today_watched_sec: z.number().int().min(0),
  today_status: z.enum(ENGLISH_PROGRESS_STATUSES).nullable(),
});

export type EnglishCatalogItem = z.infer<typeof englishCatalogItemSchema>;

export const englishCatalogResponseSchema = z.object({
  current_day: z.number().int().positive(),
  selected_lesson_id: z.string().uuid().nullable(),
  lessons: z.array(englishCatalogItemSchema),
});

export type EnglishCatalogResponse = z.infer<typeof englishCatalogResponseSchema>;

export const englishCompleteRequestSchema = z.object({
  watched_sec: z.number().int().min(0),
});

export type EnglishCompleteRequest = z.infer<typeof englishCompleteRequestSchema>;

export const englishCompleteResponseSchema = z.object({
  current_day: z.number().int().positive(),
  day_status: z.literal("success"),
  watched_sec: z.number().int().min(0),
  preview_next_day: z.number().int().positive(),
});

export type EnglishCompleteResponse = z.infer<typeof englishCompleteResponseSchema>;

export const englishSkipResponseSchema = z.object({
  current_day: z.number().int().positive(),
  day_status: z.literal("skipped"),
  preview_next_day: z.number().int().positive(),
});

export type EnglishSkipResponse = z.infer<typeof englishSkipResponseSchema>;

export const englishHistoryItemSchema = z.object({
  date: z.string().date(),
  status: z.enum(ENGLISH_PROGRESS_STATUSES),
  watched_sec: z.number().int().min(0),
  lesson: englishLessonSchema.nullable(),
});

export const englishHistoryResponseSchema = z.object({
  items: z.array(englishHistoryItemSchema),
});

export type EnglishHistoryResponse = z.infer<typeof englishHistoryResponseSchema>;

export const patchEnglishSettingsRequestSchema = z.object({
  is_enabled: z.boolean(),
});

export type PatchEnglishSettingsRequest = z.infer<typeof patchEnglishSettingsRequestSchema>;

export const englishSettingsResponseSchema = z.object({
  is_enabled: z.boolean(),
  current_day: z.number().int().positive(),
  started_at: z.string().date().nullable(),
});

export type EnglishSettingsResponse = z.infer<typeof englishSettingsResponseSchema>;
