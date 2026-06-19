import { z } from "zod";

export const pomodoroSessionSchema = z.object({
  id: z.string().uuid(),
  habit_id: z.string().uuid(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  work_min: z.number().int().min(1),
  completed: z.boolean(),
  remaining_sec: z.number().int().min(0).optional(),
});

export type PomodoroSessionResponse = z.infer<typeof pomodoroSessionSchema>;

export const pomodoroActiveResponseSchema = z.object({
  session: pomodoroSessionSchema.nullable(),
});

export type PomodoroActiveResponse = z.infer<typeof pomodoroActiveResponseSchema>;

export const pomodoroCompleteResponseSchema = z.object({
  session: pomodoroSessionSchema,
  minutes_added: z.number().int().min(0),
  checkin: z.object({
    date: z.string().date(),
    status: z.enum(["success", "fail", "pending", "skipped"]),
    value: z.number().nullable(),
    current_goal: z.number(),
    preview_next_goal: z.number(),
  }),
});

export type PomodoroCompleteResponse = z.infer<typeof pomodoroCompleteResponseSchema>;
