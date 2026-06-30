import { z } from "zod";
import { DOOM_SCROLL_PLATFORMS } from "../constants/doom-scroll.js";

export const doomScrollPlatformSchema = z.enum(DOOM_SCROLL_PLATFORMS);

export type DoomScrollPlatform = z.infer<typeof doomScrollPlatformSchema>;

export const startDoomScrollRequestSchema = z.object({
  platform: doomScrollPlatformSchema.optional(),
});

export type StartDoomScrollRequest = z.infer<typeof startDoomScrollRequestSchema>;

export const doomScrollSessionSchema = z.object({
  id: z.string().uuid(),
  habit_id: z.string().uuid(),
  started_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  duration_min: z.number().int().min(1),
  completed: z.boolean(),
  remaining_sec: z.number().int().min(0).optional(),
});

export type DoomScrollSessionResponse = z.infer<typeof doomScrollSessionSchema>;

export const doomScrollActiveResponseSchema = z.object({
  session: doomScrollSessionSchema.nullable(),
});

export type DoomScrollActiveResponse = z.infer<typeof doomScrollActiveResponseSchema>;

export const doomScrollStopResponseSchema = z.object({
  session: doomScrollSessionSchema,
  minutes_added: z.number().int().min(0),
  checkin: z.object({
    date: z.string().date(),
    status: z.enum(["success", "fail", "pending", "skipped"]),
    value: z.number().nullable(),
    current_goal: z.number(),
    preview_next_goal: z.number(),
  }),
});

export type DoomScrollStopResponse = z.infer<typeof doomScrollStopResponseSchema>;
