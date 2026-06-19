import { addDays } from "../stats/day-color.js";
import { getUserLocalDate } from "./user-day.js";

export type UserTimezoneState = {
  timezone: string;
  pendingTimezone: string | null;
  pendingTimezoneFrom: string | null;
};

/** Effective timezone for day-close and new checkins (§24.7). */
export function resolveEffectiveTimezone(state: UserTimezoneState, now: Date): string {
  if (!state.pendingTimezone || !state.pendingTimezoneFrom) {
    return state.timezone;
  }

  const today = getUserLocalDate(now, state.timezone);
  if (today >= state.pendingTimezoneFrom) {
    return state.pendingTimezone;
  }

  return state.timezone;
}

export function scheduleTimezoneChange(
  currentTimezone: string,
  newTimezone: string,
  now: Date,
): { pendingTimezone: string; pendingTimezoneFrom: string } {
  const today = getUserLocalDate(now, currentTimezone);
  return {
    pendingTimezone: newTimezone,
    pendingTimezoneFrom: addDays(today, 1),
  };
}

export function shouldApplyPendingTimezone(state: UserTimezoneState, now: Date): boolean {
  if (!state.pendingTimezone || !state.pendingTimezoneFrom) {
    return false;
  }

  const today = getUserLocalDate(now, state.timezone);
  return today >= state.pendingTimezoneFrom;
}
