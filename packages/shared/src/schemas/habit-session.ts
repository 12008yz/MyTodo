import { z } from "zod";

export const habitSessionSchema = z.object({
  id: z.string().uuid(),
  habit_id: z.string().uuid(),
  block_id: z.string().nullable(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  planned_min: z.number().int().positive(),
  planned_seconds: z.number().int().positive().nullable().optional(),
  actual_min: z.number().int().nullable(),
  value_added: z.number().nullable(),
  completed: z.boolean(),
  is_paused: z.boolean().optional(),
  remaining_seconds: z.number().int().min(0).optional(),
});

export type HabitSessionResponse = z.infer<typeof habitSessionSchema>;

export const startHabitSessionRequestSchema = z.object({
  block_id: z.string().optional(),
  planned_min: z.number().int().positive().optional(),
  planned_seconds: z.number().int().positive().optional(),
});

export type StartHabitSessionRequest = z.infer<typeof startHabitSessionRequestSchema>;

export const completeHabitSessionRequestSchema = z.object({
  block_id: z.string().optional(),
  actual_value: z.number().min(0).optional(),
  ended_early: z.boolean().optional(),
});

export type CompleteHabitSessionRequest = z.infer<
  typeof completeHabitSessionRequestSchema
>;

export const habitSessionActiveResponseSchema = z.object({
  session: habitSessionSchema.nullable(),
});

export type HabitSessionActiveResponse = z.infer<
  typeof habitSessionActiveResponseSchema
>;

export const habitSessionCompleteResponseSchema = z.object({
  session: habitSessionSchema,
  checkin: z.object({
    date: z.string().date(),
    status: z.enum(["success", "fail", "pending", "skipped"]),
    value: z.number(),
    current_goal: z.number(),
    preview_next_goal: z.number(),
  }),
  value_added: z.number(),
});

export type HabitSessionCompleteResponse = z.infer<
  typeof habitSessionCompleteResponseSchema
>;
