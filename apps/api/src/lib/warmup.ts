import {
  isHabitEnforcementActive,
  isWarmupDay,
  resolveWarmupAnchor,
  resolveWarmupDayInfo,
} from "@mytodo/domain";
import { getWarmupDayMessage, type HarshnessLevel } from "@mytodo/shared";
import type { User } from "../db/schema/index.js";

export function warmupAnchorFromUser(user: User): Date {
  return resolveWarmupAnchor(user.onboardingCompletedAt, user.createdAt);
}

export function isWarmupDayForUser(user: User, planDate: string): boolean {
  return isWarmupDay(warmupAnchorFromUser(user), planDate, user.timezone);
}

export function isEnforcementActiveForUser(user: User, planDate: string): boolean {
  return isHabitEnforcementActive(warmupAnchorFromUser(user), planDate, user.timezone);
}

export function buildWarmupDayPayload(user: User, planDate: string) {
  const info = resolveWarmupDayInfo({
    onboardingCompletedAt: user.onboardingCompletedAt,
    registeredAt: user.createdAt,
    planDate,
    timezone: user.timezone,
    wakeTime: user.wakeTime,
    sleepTime: user.sleepTime,
  });

  const harshness = Math.min(3, Math.max(1, user.harshnessLevel)) as HarshnessLevel;

  return {
    active: info.active,
    slot: info.slot,
    message: getWarmupDayMessage(info.slot, harshness),
  };
}
