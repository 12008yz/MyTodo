/** Elapsed whole minutes between two timestamps (partial minute rounds up). */
export function computeElapsedMinutes(startedAt: Date, endedAt: Date): number {
  const ms = endedAt.getTime() - startedAt.getTime();
  if (ms <= 0) {
    return 0;
  }

  return Math.ceil(ms / 60_000);
}

/** Seconds remaining until `endsAt`, floored at zero. */
export function computeRemainingSeconds(now: Date, endsAt: Date): number {
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) {
    return 0;
  }

  return Math.ceil(ms / 1000);
}

/** Actual doom-scroll minutes capped at the planned session end. */
export function computeDoomScrollMinutes(
  startedAt: Date,
  plannedEndsAt: Date,
  actualEnd: Date,
): number {
  const effectiveEnd = actualEnd.getTime() < plannedEndsAt.getTime() ? actualEnd : plannedEndsAt;
  return computeElapsedMinutes(startedAt, effectiveEnd);
}
