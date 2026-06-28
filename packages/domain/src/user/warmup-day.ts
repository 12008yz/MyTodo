import { getUserLocalDate } from "../time/user-day.js";
import {
  getLocalTimeParts,
  localTimeToMinutes,
  parseLocalTime,
  type LocalTime,
} from "../push/schedule.js";

export type DayStartSlot = "morning" | "day" | "evening" | "night";

/** After this local time on the anchor night, warmup day is rest (no morning wake). */
export const WARMUP_LATE_NIGHT_REST_AFTER_MINUTE = 50;

const EVENING_OFFSET_MIN = 30;
const NOON_MINUTES = 12 * 60;
const DEFAULT_MORNING_START_MIN = 6 * 60;

function anchorLocalMinute(anchor: Date, timezone: string): number {
  return localTimeToMinutes(normalizeHour(getLocalTimeParts(anchor, timezone)));
}

/**
 * Onboarding between 00:00 and 00:49 — upcoming wake (e.g. 07:00) still counts on the warmup day.
 * From 00:50 onward that morning is treated as rest.
 */
export function isWarmupPreDawnSignup(anchor: Date, timezone: string): boolean {
  return anchorLocalMinute(anchor, timezone) < WARMUP_LATE_NIGHT_REST_AFTER_MINUTE;
}

function normalizeHour(time: LocalTime): LocalTime {
  if (time.hour === 24) {
    return { hour: 0, minute: time.minute };
  }

  return time;
}

function isMinuteInRange(minute: number, start: number, end: number): boolean {
  if (start === end) {
    return false;
  }

  if (start < end) {
    return minute >= start && minute < end;
  }

  return minute >= start || minute < end;
}

function formatWakeTime(value: string): string {
  return value.trim().slice(0, 5);
}

/** Calendar day when the user's plan starts (onboarding completion, else registration). */
export function resolveWarmupAnchor(
  onboardingCompletedAt: Date | null | undefined,
  registeredAt: Date,
): Date {
  return onboardingCompletedAt ?? registeredAt;
}

/** True on the first calendar day of the plan — no auto-fails, exercises optional. */
export function isWarmupDay(anchor: Date, planDate: string, timezone: string): boolean {
  return planDate === getUserLocalDate(anchor, timezone);
}

/** Normal habit rules (early rise window, day-close fails) apply from the next local day. */
export function isHabitEnforcementActive(
  anchor: Date,
  planDate: string,
  timezone: string,
): boolean {
  return planDate > getUserLocalDate(anchor, timezone);
}

export function resolveDayStartSlot(
  moment: Date,
  timezone: string,
  wakeTime?: string | null,
  sleepTime?: string | null,
): DayStartSlot {
  const minute = localTimeToMinutes(normalizeHour(getLocalTimeParts(moment, timezone)));

  if (wakeTime && sleepTime) {
    const wakeMin = localTimeToMinutes(parseLocalTime(formatWakeTime(wakeTime)));
    let sleepMin = localTimeToMinutes(parseLocalTime(formatSleepTime(sleepTime)));
    let spanMin = sleepMin - wakeMin;

    if (spanMin <= 0) {
      spanMin += 24 * 60;
      if (sleepMin <= wakeMin) {
        sleepMin += 24 * 60;
      }
    }

    const afternoonMin = wakeMin + Math.floor(spanMin / 2);
    const eveningStartMin = afternoonMin;
    const nightStartMin = sleepMin - EVENING_OFFSET_MIN;

    if (isMinuteInRange(minute, wakeMin, NOON_MINUTES)) {
      return "morning";
    }

    if (isMinuteInRange(minute, NOON_MINUTES, eveningStartMin)) {
      return "day";
    }

    if (isMinuteInRange(minute, eveningStartMin, nightStartMin)) {
      return "evening";
    }

    return "night";
  }

  if (minute >= 6 * 60 && minute < NOON_MINUTES) {
    return "morning";
  }

  if (minute >= NOON_MINUTES && minute < 18 * 60) {
    return "day";
  }

  if (minute >= 18 * 60 && minute < 22 * 60) {
    return "evening";
  }

  return "night";
}

function formatSleepTime(value: string): string {
  return value.trim().slice(0, 5);
}

export type WarmupDayInfo = {
  active: boolean;
  slot: DayStartSlot;
  earlyRiseEnforcement: boolean;
};

/** Warmup banner slot — pre-dawn signup keeps morning; 00:50–06:00 is night rest. */
export function resolveWarmupDaySlot(
  anchor: Date,
  timezone: string,
  wakeTime?: string | null,
  sleepTime?: string | null,
): DayStartSlot {
  const minute = anchorLocalMinute(anchor, timezone);

  if (minute < WARMUP_LATE_NIGHT_REST_AFTER_MINUTE) {
    return "morning";
  }

  if (minute >= WARMUP_LATE_NIGHT_REST_AFTER_MINUTE && minute < DEFAULT_MORNING_START_MIN) {
    return "night";
  }

  return resolveDayStartSlot(anchor, timezone, wakeTime, sleepTime);
}

export function resolveWarmupDayInfo(params: {
  onboardingCompletedAt: Date | null | undefined;
  registeredAt: Date;
  planDate: string;
  timezone: string;
  wakeTime?: string | null;
  sleepTime?: string | null;
}): WarmupDayInfo {
  const anchor = resolveWarmupAnchor(params.onboardingCompletedAt, params.registeredAt);
  const active = isWarmupDay(anchor, params.planDate, params.timezone);

  const preDawnSignup = isWarmupPreDawnSignup(anchor, params.timezone);

  return {
    active,
    slot: active
      ? resolveWarmupDaySlot(anchor, params.timezone, params.wakeTime, params.sleepTime)
      : "morning",
    earlyRiseEnforcement: active && preDawnSignup,
  };
}
