export function getUserLocalDate(utc: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(utc);
}

/** True when local time in the user's timezone is 23:59 (day-close minute, §8.3). */
export function isDayCloseMinute(utc: Date, timezone: string): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(utc);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  return hour === 23 && minute === 59;
}
