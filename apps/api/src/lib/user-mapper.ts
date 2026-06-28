import type { User } from "../db/schema/index.js";
import type { UserProfile } from "@mytodo/shared";
import { effectiveHarshnessLevel, isSilenceModeActive } from "@mytodo/domain";

function formatTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, 5);
}

function toNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  return Number(value);
}

function toDateString(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

export function toUserProfile(user: User, now: Date = new Date()): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    age: user.age,
    gender: user.gender as UserProfile["gender"],
    weight_kg: toNumber(user.weightKg),
    height_cm: toNumber(user.heightCm),
    free_time_min: user.freeTimeMin,
    daily_budget_min: user.dailyBudgetMin,
    timezone: user.timezone,
    wake_time: formatTime(user.wakeTime),
    sleep_time: formatTime(user.sleepTime),
    pomodoro_work_min: user.pomodoroWorkMin,
    pomodoro_break_min: user.pomodoroBreakMin,
    pomodoro_long_break_min: user.pomodoroLongBreakMin,
    harshness_level: user.harshnessLevel,
    role: user.role as UserProfile["role"],
    onboarding_completed: user.onboardingCompleted,
    onboarding_completed_at: user.onboardingCompletedAt?.toISOString() ?? null,
    trial_ends_at: user.trialEndsAt.toISOString(),
    silence_mode_until: user.silenceModeUntil?.toISOString() ?? null,
    silence_mode_active: isSilenceModeActive(user.silenceModeUntil, now),
    effective_harshness_level: effectiveHarshnessLevel(
      user.harshnessLevel,
      user.silenceModeUntil,
      now,
    ),
    pending_timezone: user.pendingTimezone,
    pending_timezone_from: toDateString(user.pendingTimezoneFrom),
    created_at: user.createdAt.toISOString(),
  };
}
