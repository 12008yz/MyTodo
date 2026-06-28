import { getUserLocalDate } from "../time/user-day.js";
import {
  getLocalTimeParts,
  localTimeToMinutes,
  parseLocalTime,
  type LocalTime,
} from "../push/schedule.js";

export type DayStartSlot = "morning" | "day" | "evening" | "night";

const EVENING_OFFSET_MIN = 30;
const NOON_MINUTES = 12 * 60;

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
};

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

  return {
    active,
    slot: active
      ? resolveDayStartSlot(anchor, params.timezone, params.wakeTime, params.sleepTime)
      : "morning",
  };
}
