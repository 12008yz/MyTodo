import { z } from "zod";

export const ENGLISH_PROGRESS_STATUSES = ["success", "fail", "pending", "skipped"] as const;
export type EnglishProgressStatus = (typeof ENGLISH_PROGRESS_STATUSES)[number];

export const ENGLISH_WATCH_THRESHOLD = 1;

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
