import { z } from "zod";
import { HABIT_SIDES, HABIT_UNITS } from "../constants/habits.js";

export const DAY_COLORS = ["success", "pending", "fail", "skipped"] as const;
export type DayColorValue = (typeof DAY_COLORS)[number];

export const STATS_SIDES = HABIT_SIDES;
export type StatsSide = (typeof STATS_SIDES)[number];

export const PROGRESS_PERIODS = ["week", "month", "quarter"] as const;
export type ProgressPeriod = (typeof PROGRESS_PERIODS)[number];

export const statsSideQuerySchema = z.object({
  side: z.enum(STATS_SIDES),
});

export const statsWeekQuerySchema = statsSideQuerySchema.extend({
  week_start: z.string().date().optional(),
});

export const statsMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  side: z.enum(STATS_SIDES).optional(),
});

export const statsCalendarQuerySchema = statsMonthQuerySchema;

export const statsProgressQuerySchema = z.object({
  period: z.enum(PROGRESS_PERIODS).default("week"),
});

export const statsSummaryQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
});

export const statsWeekDaySchema = z.object({
  date: z.string().date(),
  color: z.enum(DAY_COLORS),
  completed: z.number().int().min(0),
  total: z.number().int().min(0),
});

export const statsWeekResponseSchema = z.object({
  week_start: z.string().date(),
  side: z.enum(STATS_SIDES),
  days: z.array(statsWeekDaySchema).length(7),
});

export type StatsWeekResponse = z.infer<typeof statsWeekResponseSchema>;

export const statsCalendarHabitSchema = z.object({
  habit_id: z.string().uuid(),
  name: z.string(),
  side: z.enum(STATS_SIDES),
  status: z.enum(["success", "fail", "skipped", "pending"]),
  value: z.number().nullable(),
});

export const statsCalendarDaySchema = z.object({
  date: z.string().date(),
  color: z.enum(DAY_COLORS),
  habits: z.array(statsCalendarHabitSchema),
});

export const statsCalendarResponseSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  days: z.array(statsCalendarDaySchema),
});

export type StatsCalendarResponse = z.infer<typeof statsCalendarResponseSchema>;

export const statsMonthResponseSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  side: z.enum(STATS_SIDES).nullable(),
  success_rate: z.number().min(0).max(100),
  relapses: z.number().int().min(0),
  skipped_days: z.number().int().min(0),
  closed_days: z.number().int().min(0),
});

export type StatsMonthResponse = z.infer<typeof statsMonthResponseSchema>;

export const STATS_CHART_MODES = ["target", "limit", "abstinence"] as const;
export type StatsChartMode = (typeof STATS_CHART_MODES)[number];

export const statsProgressPointSchema = z.object({
  date: z.string().date(),
  goal: z.number().nullable(),
  value: z.number().nullable(),
  status: z.enum(["success", "fail", "skipped", "pending"]).nullable(),
  minutes_total: z.number().int().min(0),
});

export const statsProgressResponseSchema = z.object({
  habit_id: z.string().uuid(),
  period: z.enum(PROGRESS_PERIODS),
  start_date: z.string().date(),
  end_date: z.string().date(),
  side: z.enum(STATS_SIDES),
  type: z.enum(["target", "limit", "abstinence"]),
  phase: z.enum(["reduction", "abstinence"]),
  unit: z.enum(HABIT_UNITS).nullable(),
  chart_mode: z.enum(STATS_CHART_MODES),
  points: z.array(statsProgressPointSchema),
});

export type StatsProgressResponse = z.infer<typeof statsProgressResponseSchema>;

export const statsSummaryDaySchema = z.object({
  date: z.string().date(),
  light_color: z.enum(DAY_COLORS),
  dark_color: z.enum(DAY_COLORS),
});

export const statsSummaryWeekSchema = z.object({
  week_start: z.string().date(),
  days: z.array(statsSummaryDaySchema).length(7),
});

export const statsSummaryResponseSchema = z.object({
  weeks: z.array(statsSummaryWeekSchema),
});

export type StatsSummaryResponse = z.infer<typeof statsSummaryResponseSchema>;
