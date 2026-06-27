import { z } from "zod";

export const habitReadingProgressSchema = z.object({
  book_id: z.string(),
  pages_read: z.number().int().min(0),
  pages_credited_today: z.number().int().min(0),
  last_read_page: z.number().int().min(1),
  timer_remaining_seconds: z.number().int().min(0).nullable().optional(),
  timer_saved_date: z.string().date().nullable().optional(),
  reader_day_start_page: z.number().int().min(1).nullable().optional(),
  reader_day_date: z.string().date().nullable().optional(),
  last_checkin_date: z.string().date().nullable(),
  completed_at: z.string().datetime().nullable(),
  page_count: z.number().int().positive().nullable().optional(),
});

export type HabitReadingProgress = z.infer<typeof habitReadingProgressSchema>;

export const selectHabitBookRequestSchema = z.object({
  book_id: z.string().min(1),
  checkin_baseline: z.number().min(0).optional(),
});

export type SelectHabitBookRequest = z.infer<typeof selectHabitBookRequestSchema>;

export const updateReadingBookmarkRequestSchema = z
  .object({
    last_read_page: z.number().int().min(1).optional(),
    timer_remaining_seconds: z.number().int().min(0).optional(),
    timer_saved_date: z.string().date().optional(),
    reader_day_start_page: z.number().int().min(1).optional(),
    reader_day_date: z.string().date().optional(),
  })
  .refine(
    (data) =>
      data.last_read_page !== undefined ||
      data.timer_remaining_seconds !== undefined ||
      data.reader_day_start_page !== undefined ||
      data.reader_day_date !== undefined,
    { message: "At least one field is required" },
  );

export type UpdateReadingBookmarkRequest = z.infer<typeof updateReadingBookmarkRequestSchema>;
