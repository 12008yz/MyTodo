import { z } from "zod";

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export const pushSubscribeRequestSchema = z.object({
  endpoint: z.string().url(),
  keys: pushSubscriptionKeysSchema,
});

export type PushSubscribeRequest = z.infer<typeof pushSubscribeRequestSchema>;

export const pushSubscribeResponseSchema = z.object({
  id: z.string().uuid(),
  endpoint: z.string().url(),
});

export type PushSubscribeResponse = z.infer<typeof pushSubscribeResponseSchema>;

export const pushUnsubscribeRequestSchema = z.object({
  endpoint: z.string().url().optional(),
});

export type PushUnsubscribeRequest = z.infer<typeof pushUnsubscribeRequestSchema>;

export const pushTestResponseSchema = z.object({
  sent: z.boolean(),
});

export type PushTestResponse = z.infer<typeof pushTestResponseSchema>;
