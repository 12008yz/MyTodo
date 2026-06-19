import { z } from "zod";
import { GENDERS } from "../constants.js";

const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM or HH:MM:SS");

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  age: z.number().int(),
  gender: z.enum(GENDERS),
  weight_kg: z.number().nullable(),
  height_cm: z.number().nullable(),
  free_time_min: z.number().int().nullable(),
  daily_budget_min: z.number().int(),
  timezone: z.string(),
  wake_time: z.string().nullable(),
  sleep_time: z.string().nullable(),
  pomodoro_work_min: z.number().int(),
  pomodoro_break_min: z.number().int(),
  pomodoro_long_break_min: z.number().int(),
  harshness_level: z.number().int().min(1).max(3),
  role: z.enum(["user", "admin"]),
  onboarding_completed: z.boolean(),
  trial_ends_at: z.string().datetime(),
  created_at: z.string().datetime(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const authResponseSchema = z.object({
  user: userProfileSchema,
  access_token: z.string(),
  refresh_token: z.string(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const patchMeRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    weight_kg: z.number().positive().max(500).optional(),
    height_cm: z.number().positive().max(300).optional(),
    free_time_min: z.number().int().positive().max(24 * 60).optional(),
    timezone: z.string().min(1).max(64).optional(),
    wake_time: timeStringSchema.optional(),
    sleep_time: timeStringSchema.optional(),
    pomodoro_work_min: z.number().int().min(1).max(120).optional(),
    pomodoro_break_min: z.number().int().min(1).max(60).optional(),
    pomodoro_long_break_min: z.number().int().min(1).max(60).optional(),
    harshness_level: z.number().int().min(1).max(3).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type PatchMeRequest = z.infer<typeof patchMeRequestSchema>;
