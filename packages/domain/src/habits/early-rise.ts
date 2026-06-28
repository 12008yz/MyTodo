import { EARLY_RISE_CONFIRM_WINDOW_MIN } from "@mytodo/shared";
import { getUserLocalDate } from "../time/user-day.js";
import { isWarmupPreDawnSignup } from "../user/warmup-day.js";
import {
  getLocalTimeParts,
  localTimeToMinutes,
  minutesToLocalTime,
  parseLocalTime,
  type LocalTime,
} from "../push/schedule.js";
import { formatEarlyRiseTargetWakeTime } from "./workload.js";

/** Saturday and Sunday for a user-local calendar date (YYYY-MM-DD). */
export function isWeekendDate(planDate: string): boolean {
  const weekday = new Date(`${planDate}T12:00:00.000Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function isEarlyRiseWeekendRest(planDate: string): boolean {
  return isWeekendDate(planDate);
}

export type EarlyRisePhase = "before" | "window" | "expired";

export type EarlyRiseWindowState = {
  phase: EarlyRisePhase;
  target_wake_time: string;
  window_end_time: string;
  seconds_remaining: number;
  seconds_until_window: number;
};

function formatLocalTime(time: { hour: number; minute: number }): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function getLocalSecond(utc: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    second: "numeric",
  }).formatToParts(utc);

  return Number(parts.find((part) => part.type === "second")?.value ?? 0);
}

function localTimeToSeconds(time: LocalTime, second: number): number {
  return localTimeToMinutes(time) * 60 + second;
}

/** Intl may return hour 24 for midnight in some runtimes. */
function normalizeLocalHour(time: LocalTime): LocalTime {
  if (time.hour === 24) {
    return { hour: 0, minute: time.minute };
  }

  return time;
}

/** Wake confirmation window: target wake time + 5 minutes to mark success. */
export function computeEarlyRiseWindowState(
  wakeTime: string,
  shiftMinutes: number,
  now: Date,
  timezone: string,
): EarlyRiseWindowState {
  const targetWakeTime = formatEarlyRiseTargetWakeTime(wakeTime, shiftMinutes);
  const target = parseLocalTime(targetWakeTime);
  const targetSeconds = localTimeToMinutes(target) * 60;
  const windowEndSeconds = targetSeconds + EARLY_RISE_CONFIRM_WINDOW_MIN * 60;
  const nowLocal = normalizeLocalHour(getLocalTimeParts(now, timezone));
  const nowSeconds = localTimeToSeconds(nowLocal, getLocalSecond(now, timezone));

  let phase: EarlyRisePhase;
  if (nowSeconds < targetSeconds) {
    phase = "before";
  } else if (nowSeconds < windowEndSeconds) {
    phase = "window";
  } else {
    phase = "expired";
  }

  return {
    phase,
    target_wake_time: targetWakeTime,
    window_end_time: formatLocalTime(
      minutesToLocalTime(localTimeToMinutes(target) + EARLY_RISE_CONFIRM_WINDOW_MIN),
    ),
    seconds_remaining: phase === "window" ? Math.max(0, windowEndSeconds - nowSeconds) : 0,
    seconds_until_window: phase === "before" ? Math.max(0, targetSeconds - nowSeconds) : 0,
  };
}

export function formatEarlyRiseCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Early rise window and GG: from the next calendar day, or on warmup day only for
 * pre-dawn signup (00:00–00:49) when the morning wake is still ahead.
 */
export function isEarlyRiseEnforcementActive(
  planAnchor: Date,
  planDate: string,
  timezone: string,
): boolean {
  if (isEarlyRiseWeekendRest(planDate)) {
    return false;
  }

  const anchorDay = getUserLocalDate(planAnchor, timezone);

  if (planDate > anchorDay) {
    return true;
  }

  if (planDate < anchorDay) {
    return false;
  }

  return isWarmupPreDawnSignup(planAnchor, timezone);
}
