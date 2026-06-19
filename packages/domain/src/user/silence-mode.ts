export const SILENCE_MODE_DURATION_MS = 24 * 60 * 60 * 1000;

export const SILENCE_MODE_COOLDOWN_DAYS = 30;

export const SILENCE_MODE_HARSHNESS_LEVEL = 1;

export function isSilenceModeActive(silenceModeUntil: Date | null, now: Date): boolean {
  return silenceModeUntil != null && silenceModeUntil > now;
}

/** Whether the user may enable silence mode (§15.3, §17.2). */
export function canEnableSilenceMode(silenceModeUsedAt: Date | null, now: Date): boolean {
  if (!silenceModeUsedAt) {
    return true;
  }

  const cooldownEnds = new Date(silenceModeUsedAt);
  cooldownEnds.setDate(cooldownEnds.getDate() + SILENCE_MODE_COOLDOWN_DAYS);
  return now >= cooldownEnds;
}

export function effectiveHarshnessLevel(
  harshnessLevel: number,
  silenceModeUntil: Date | null,
  now: Date,
): number {
  if (isSilenceModeActive(silenceModeUntil, now)) {
    return SILENCE_MODE_HARSHNESS_LEVEL;
  }

  return harshnessLevel;
}
