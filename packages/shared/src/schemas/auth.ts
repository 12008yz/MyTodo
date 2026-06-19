import { z } from "zod";
import { DEFAULT_TIMEZONE, GENDERS } from "../constants.js";

const passwordSchema = z.string().min(8).max(128);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email().max(255));

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(255),
  age: z.number().int().min(10).max(120),
  gender: z.enum(GENDERS),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refresh_token: z.string().min(1),
});

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const logoutRequestSchema = z.object({
  refresh_token: z.string().min(1),
});

export type LogoutRequest = z.infer<typeof logoutRequestSchema>;

export const authTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export function resolveTimezone(timezone?: string): string {
  return timezone?.trim() || DEFAULT_TIMEZONE;
}
