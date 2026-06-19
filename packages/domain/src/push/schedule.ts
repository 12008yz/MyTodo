export const PUSH_SCHEDULE_EVENTS = ["morning", "afternoon", "evening"] as const;

export type PushScheduleEvent = (typeof PUSH_SCHEDULE_EVENTS)[number];

export type LocalTime = {
  hour: number;
  minute: number;
};

export type ScheduledPushSlot = {
  eventType: PushScheduleEvent;
  at: LocalTime;
};

const MIN_WAKE_SLEEP_HOURS = 6;
const EVENING_OFFSET_MIN = 30;
const MIN_CHEER_GAP_MIN = 120;

export function parseLocalTime(value: string): LocalTime {
  const [hourPart, minutePart] = value.split(":");
  return {
    hour: Number(hourPart),
    minute: Number(minutePart),
  };
}

export function localTimeToMinutes(time: LocalTime): number {
  return time.hour * 60 + time.minute;
}

export function minutesToLocalTime(totalMinutes: number): LocalTime {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return {
    hour: Math.floor(normalized / 60),
    minute: normalized % 60,
  };
}

export function addMinutesToLocalTime(time: LocalTime, minutes: number): LocalTime {
  return minutesToLocalTime(localTimeToMinutes(time) + minutes);
}

export function computeDailyPushSchedule(
  wakeTime: string,
  sleepTime: string,
): ScheduledPushSlot[] {
  const wake = parseLocalTime(wakeTime);
  const sleep = parseLocalTime(sleepTime);
  const spanMin = localTimeToMinutes(sleep) - localTimeToMinutes(wake);

  const morning: ScheduledPushSlot = { eventType: "morning", at: wake };

  if (spanMin < MIN_WAKE_SLEEP_HOURS * 60) {
    return [morning, { eventType: "evening", at: addMinutesToLocalTime(sleep, -EVENING_OFFSET_MIN) }];
  }

  return [
    morning,
    {
      eventType: "afternoon",
      at: addMinutesToLocalTime(wake, Math.floor(spanMin / 2)),
    },
    { eventType: "evening", at: addMinutesToLocalTime(sleep, -EVENING_OFFSET_MIN) },
  ];
}

export function getLocalTimeParts(utc: Date, timezone: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(utc);

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value),
  };
}

export function isLocalTimeMatch(utc: Date, timezone: string, target: LocalTime): boolean {
  const local = getLocalTimeParts(utc, timezone);
  return local.hour === target.hour && local.minute === target.minute;
}

/** Deterministic 3–5 cheer pushes per local day (§9.2). */
export function pickCheerCount(localDate: string): number {
  let hash = 0;
  for (const char of localDate) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return 3 + (hash % 3);
}

export function computeCheerSlotTimes(
  wakeTime: string,
  sleepTime: string,
  count: number,
): LocalTime[] {
  const wake = parseLocalTime(wakeTime);
  const sleep = parseLocalTime(sleepTime);
  const spanMin = localTimeToMinutes(sleep) - localTimeToMinutes(wake);

  if (count <= 0 || spanMin <= 0) {
    return [];
  }

  const interval = Math.max(MIN_CHEER_GAP_MIN, Math.floor(spanMin / (count + 1)));
  const slots: LocalTime[] = [];

  for (let index = 1; index <= count; index += 1) {
    slots.push(addMinutesToLocalTime(wake, interval * index));
  }

  return slots;
}

export function findDueScheduleEvents(
  utc: Date,
  timezone: string,
  wakeTime: string,
  sleepTime: string,
): PushScheduleEvent[] {
  return computeDailyPushSchedule(wakeTime, sleepTime)
    .filter((slot) => isLocalTimeMatch(utc, timezone, slot.at))
    .map((slot) => slot.eventType);
}

export function findDueCheerSlot(
  utc: Date,
  timezone: string,
  wakeTime: string,
  sleepTime: string,
  localDate: string,
): number | null {
  const count = pickCheerCount(localDate);
  const slots = computeCheerSlotTimes(wakeTime, sleepTime, count);

  for (let index = 0; index < slots.length; index += 1) {
    if (isLocalTimeMatch(utc, timezone, slots[index]!)) {
      return index + 1;
    }
  }

  return null;
}
