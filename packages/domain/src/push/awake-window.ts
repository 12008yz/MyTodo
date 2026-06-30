import { getLocalTimeParts, localTimeToMinutes, parseLocalTime, type LocalTime } from "./schedule.js";

/** User is within their awake window (wake_time … sleep_time from profile). */
export function isUserAwakeAtMinutes(
  nowMinutes: number,
  wakeMinutes: number,
  sleepMinutes: number,
): boolean {
  if (wakeMinutes === sleepMinutes) {
    return true;
  }

  if (wakeMinutes < sleepMinutes) {
    return nowMinutes >= wakeMinutes && nowMinutes < sleepMinutes;
  }

  // Sleep after midnight, e.g. wake 07:00, sleep 01:00.
  return nowMinutes >= wakeMinutes || nowMinutes < sleepMinutes;
}

export function isUserAwake(
  utc: Date,
  timezone: string,
  wakeTime: string,
  sleepTime: string,
): boolean {
  const local = getLocalTimeParts(utc, timezone);
  return isUserAwakeAtMinutes(
    localTimeToMinutes(local),
    localTimeToMinutes(parseLocalTime(wakeTime)),
    localTimeToMinutes(parseLocalTime(sleepTime)),
  );
}

export function isLocalTimeMatchOr(
  utc: Date,
  timezone: string,
  targets: Array<LocalTime | string | null | undefined>,
): boolean {
  for (const target of targets) {
    if (!target) {
      continue;
    }

    const localTime = typeof target === "string" ? parseLocalTime(target) : target;
    const parts = getLocalTimeParts(utc, timezone);
    if (parts.hour === localTime.hour && parts.minute === localTime.minute) {
      return true;
    }
  }

  return false;
}

/** First minute of the user's day — flush overnight deferred pushes. */
export function isWakeFlushMinute(
  utc: Date,
  timezone: string,
  wakeTime: string,
  earlyRiseTargetWakeTime?: string | null,
): boolean {
  return isLocalTimeMatchOr(utc, timezone, [wakeTime, earlyRiseTargetWakeTime]);
}
