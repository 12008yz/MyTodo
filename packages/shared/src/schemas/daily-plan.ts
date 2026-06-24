import { z } from "zod";
import { habitUnitSchema } from "./habits.js";

export const dailyPlanBlockStatusSchema = z.enum(["pending", "active", "completed"]);

export type DailyPlanBlockStatus = z.infer<typeof dailyPlanBlockStatusSchema>;

export const dailyPlanBlockSchema = z.object({
  id: z.string(),
  habit_id: z.string().uuid(),
  habit_name: z.string(),
  icon: z.string().nullable(),
  unit: habitUnitSchema,
  duration_min: z.number().int().positive(),
  expected_yield: z.number(),
  order: z.number().int().min(0),
  status: dailyPlanBlockStatusSchema,
  actual_value: z.number().nullable(),
  actual_minutes: z.number().int().nullable(),
});

export type DailyPlanBlock = z.infer<typeof dailyPlanBlockSchema>;

export const dailyPlanSchema = z.object({
  blocks: z.array(dailyPlanBlockSchema),
  minutes_planned: z.number().int().min(0),
  minutes_completed: z.number().int().min(0),
  minutes_remaining: z.number().int().min(0),
});

export type DailyPlan = z.infer<typeof dailyPlanSchema>;
