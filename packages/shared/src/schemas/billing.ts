import { z } from "zod";
import { SUBSCRIPTION_PLAN_IDS } from "../constants.js";

export const SUBSCRIPTION_STATUSES = [
  "active",
  "canceled",
  "expired",
  "past_due",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const subscribeRequestSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLAN_IDS),
});

export type SubscribeRequest = z.infer<typeof subscribeRequestSchema>;

export const subscribeResponseSchema = z.object({
  payment_id: z.string(),
  confirmation_url: z.string().url(),
  plan: z.enum(SUBSCRIPTION_PLAN_IDS),
  amount_rub: z.number().int().positive(),
});

export type SubscribeResponse = z.infer<typeof subscribeResponseSchema>;

export const subscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  plan: z.enum(SUBSCRIPTION_PLAN_IDS),
  status: z.enum(SUBSCRIPTION_STATUSES),
  current_period_end: z.string().datetime(),
  created_at: z.string().datetime(),
});

export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;

export const cancelSubscriptionResponseSchema = subscriptionResponseSchema;

export type CancelSubscriptionResponse = z.infer<typeof cancelSubscriptionResponseSchema>;
