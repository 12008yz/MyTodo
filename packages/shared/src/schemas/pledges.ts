import { z } from "zod";
import { PLEDGE_CHARITY_FUNDS, PLEDGE_STATUSES } from "../constants.js";

export const createPledgeRequestSchema = z.object({
  habit_id: z.string().uuid(),
  charity_fund: z.enum(PLEDGE_CHARITY_FUNDS),
});

export type CreatePledgeRequest = z.infer<typeof createPledgeRequestSchema>;

export const pledgeResponseSchema = z.object({
  id: z.string().uuid(),
  habit_id: z.string().uuid(),
  amount_rub: z.number().int(),
  status: z.enum(PLEDGE_STATUSES),
  charity_fund: z.enum(PLEDGE_CHARITY_FUNDS),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type PledgeResponse = z.infer<typeof pledgeResponseSchema>;

export const createPledgePaymentResponseSchema = z.object({
  payment_id: z.string(),
  confirmation_url: z.string().url(),
  amount_rub: z.number().int().positive(),
  habit_id: z.string().uuid(),
  charity_fund: z.enum(PLEDGE_CHARITY_FUNDS),
});

export type CreatePledgePaymentResponse = z.infer<typeof createPledgePaymentResponseSchema>;
