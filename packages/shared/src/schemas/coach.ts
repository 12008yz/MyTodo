import { z } from "zod";

export const coachChatRequestSchema = z.object({
  habit_id: z.string().uuid(),
  message: z.string().trim().min(1).max(500),
});

export type CoachChatRequest = z.infer<typeof coachChatRequestSchema>;

export const coachChatResponseSchema = z.object({
  reply: z.string(),
  messages_left: z.number().int().min(0),
  source: z.enum(["gigachat", "template"]),
});

export type CoachChatResponse = z.infer<typeof coachChatResponseSchema>;
