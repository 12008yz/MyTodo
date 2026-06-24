import { z } from "zod";
import { dailyPlanSchema } from "./daily-plan.js";
import { habitResponseSchema } from "./habits.js";
import { checkinResponseSchema } from "./checkins.js";
import { doomScrollSessionSchema } from "./doom-scroll.js";

export const todayStatsSchema = z.object({
  completed_today: z.number().int().min(0),
  relapses_this_week: z.number().int().min(0),
  minutes_today: z.number().int().min(0),
  pomodoros_today: z.number().int().min(0),
  streak_days: z.number().int().min(0),
});

export type TodayStats = z.infer<typeof todayStatsSchema>;

const todayCheckinSchema = checkinResponseSchema
  .pick({
    id: true,
    date: true,
    status: true,
    value: true,
    updated_at: true,
    current_goal: true,
    preview_next_goal: true,
  })
  .nullable();

export const todayLightHabitSchema = habitResponseSchema.extend({
  checkin: todayCheckinSchema,
  preview_next_goal: z.number(),
  streak_days: z.number().int().min(0),
});

export type TodayLightHabit = z.infer<typeof todayLightHabitSchema>;

export const todayLightResponseSchema = z.object({
  date: z.string().date(),
  greeting_name: z.string(),
  daily_budget_min: z.number().int().min(0),
  minutes_logged_today: z.number().int().min(0),
  stats: todayStatsSchema,
  habits: z.array(todayLightHabitSchema),
  daily_plan: dailyPlanSchema,
});

export type TodayLightResponse = z.infer<typeof todayLightResponseSchema>;

export const abstinenceTimerSchema = z.object({
  started_at: z.string().datetime(),
  elapsed: z.object({
    days: z.number().int().min(0),
    hours: z.number().int().min(0).max(23),
    minutes: z.number().int().min(0).max(59),
    seconds: z.number().int().min(0).max(59),
    total_seconds: z.number().int().min(0),
  }),
});

export type AbstinenceTimer = z.infer<typeof abstinenceTimerSchema>;

export const todayDarkHabitSchema = habitResponseSchema.extend({
  checkin: todayCheckinSchema,
  preview_next_goal: z.number(),
  streak_days: z.number().int().min(0),
  timer: abstinenceTimerSchema.nullable(),
  doom_scroll_active: doomScrollSessionSchema.nullable(),
});

export type TodayDarkHabit = z.infer<typeof todayDarkHabitSchema>;

export const todayDarkResponseSchema = z.object({
  date: z.string().date(),
  greeting_name: z.string(),
  stats: todayStatsSchema,
  habits: z.array(todayDarkHabitSchema),
  daily_plan: dailyPlanSchema.optional(),
});

export type TodayDarkResponse = z.infer<typeof todayDarkResponseSchema>;

export const habitTimerResponseSchema = z.object({
  habit_id: z.string().uuid(),
  timer: abstinenceTimerSchema,
});

export type HabitTimerResponse = z.infer<typeof habitTimerResponseSchema>;
