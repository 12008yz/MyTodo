import { z } from "zod";
import {
  CUSTOM_HABIT_UNITS,
  HABIT_CATEGORY_KEYS,
  HABIT_TEMPLATE_IDS,
  HABIT_UNITS,
} from "../constants/habits.js";

export const habitUnitSchema = z.enum(HABIT_UNITS);

const baselineSchema = z.number().min(0).max(10_000);

export const createHabitFromTemplateSchema = z.object({
  template_id: z.enum(HABIT_TEMPLATE_IDS),
  baseline_value: baselineSchema.optional(),
  icon: z.string().max(32).optional(),
});

export const createCustomHabitSchema = z.object({
  name: z.string().trim().min(1).max(255),
  unit: z.enum(CUSTOM_HABIT_UNITS),
  baseline_value: baselineSchema,
  category_key: z.enum(HABIT_CATEGORY_KEYS).optional(),
  icon: z.string().max(32).optional(),
});

export const createHabitRequestSchema = z.union([
  createHabitFromTemplateSchema,
  createCustomHabitSchema,
]).superRefine((body, ctx) => {
  if ("template_id" in body && "name" in body) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Use either template_id or custom habit fields, not both",
    });
  }
});

export type CreateHabitRequest = z.infer<typeof createHabitRequestSchema>;

export const patchHabitRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    current_goal: z.number().min(0).max(10_000).optional(),
    icon: z.string().max(32).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type PatchHabitRequest = z.infer<typeof patchHabitRequestSchema>;

export const habitResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  type: z.enum(["target", "limit", "abstinence"]),
  side: z.enum(["light", "dark"]),
  unit: z.enum(HABIT_UNITS).nullable(),
  baseline_value: z.number(),
  current_goal: z.number(),
  growth_step: z.number(),
  progression_interval_days: z.number().int().min(1),
  success_days_at_goal: z.number().int().min(0),
  progression_direction: z.enum(["increase", "decrease", "abstain"]),
  phase: z.enum(["reduction", "abstinence"]),
  last_relapse_at: z.string().datetime().nullable(),
  allows_weekly_skip: z.boolean(),
  is_custom: z.boolean(),
  icon: z.string().nullable(),
  is_active: z.boolean(),
  template_id: z.enum(HABIT_TEMPLATE_IDS).nullable(),
  category_key: z.enum(HABIT_CATEGORY_KEYS).nullable(),
  harshness_level: z.number().int().min(1).max(3),
  created_at: z.string().datetime(),
});

export type HabitResponse = z.infer<typeof habitResponseSchema>;
