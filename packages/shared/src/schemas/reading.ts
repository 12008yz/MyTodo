import { z } from "zod";

export const habitReadingProgressSchema = z.object({
  book_id: z.string(),
  pages_read: z.number().int().min(0),
  pages_credited_today: z.number().int().min(0),
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
