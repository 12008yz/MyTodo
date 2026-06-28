import { useEffect, useState } from "react";
import {
  computeEarlyRiseWindowState,
  type EarlyRiseWindowState,
} from "@mytodo/domain";
import { DEFAULT_TIMEZONE } from "@mytodo/shared";

export function useEarlyRiseWindow(params: {
  enabled: boolean;
  wakeTime?: string | null;
  shiftMinutes: number;
  timezone?: string | null;
}): EarlyRiseWindowState | null {
  const { enabled, wakeTime, shiftMinutes, timezone } = params;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled || !wakeTime) {
      return;
    }

    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled, wakeTime, shiftMinutes, timezone]);

  if (!enabled || !wakeTime) {
    return null;
  }

  return computeEarlyRiseWindowState(
    wakeTime,
    shiftMinutes,
    now,
    timezone?.trim() || DEFAULT_TIMEZONE,
  );
}
