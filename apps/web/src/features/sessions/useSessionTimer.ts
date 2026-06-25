import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { getRemainingSecondsFromStart } from "./sessionRecovery";

type UseSessionTimerOptions = {
  sessionKey: string | null;
  plannedMin: number;
  startedAt?: string | null;
  autoStart?: boolean;
};

export function useSessionTimer({
  sessionKey,
  plannedMin,
  startedAt,
  autoStart = true,
}: UseSessionTimerOptions) {
  const totalSeconds = Math.max(1, Math.round(plannedMin * 60));
  const isActive = Boolean(sessionKey && startedAt);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [armed, setArmed] = useState(false);

  const syncRemaining = useCallback(() => {
    if (!startedAt) {
      return 0;
    }
    return getRemainingSecondsFromStart(startedAt, plannedMin);
  }, [plannedMin, startedAt]);

  useLayoutEffect(() => {
    if (!sessionKey || !startedAt) {
      setRemainingSeconds(0);
      setIsPaused(true);
      setArmed(false);
      return;
    }

    setRemainingSeconds(syncRemaining());
    setIsPaused(!autoStart);
    setArmed(true);
  }, [autoStart, sessionKey, startedAt, syncRemaining]);

  useEffect(() => {
    if (!armed || isPaused || !startedAt) {
      return;
    }

    const tick = () => setRemainingSeconds(syncRemaining());

    tick();
    const timerId = window.setInterval(tick, 1000);

    return () => window.clearInterval(timerId);
  }, [armed, isPaused, startedAt, syncRemaining]);

  useEffect(() => {
    if (!armed || isPaused || !startedAt) {
      return;
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setRemainingSeconds(syncRemaining());
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [armed, isPaused, startedAt, syncRemaining]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => {
    setRemainingSeconds(syncRemaining());
    setIsPaused(false);
  }, [syncRemaining]);
  const togglePause = useCallback(() => {
    setIsPaused((paused) => {
      if (paused) {
        setRemainingSeconds(syncRemaining());
      }
      return !paused;
    });
  }, [syncRemaining]);

  const elapsedSeconds = useMemo(
    () => Math.min(totalSeconds, Math.max(totalSeconds - remainingSeconds, 0)),
    [remainingSeconds, totalSeconds],
  );

  const elapsedMin = useMemo(() => {
    if (elapsedSeconds <= 0) {
      return 0;
    }
    return Math.ceil(elapsedSeconds / 60);
  }, [elapsedSeconds]);

  const isFinished = armed && isActive && remainingSeconds <= 0;

  return {
    remainingSeconds,
    elapsedSeconds,
    elapsedMin,
    totalSeconds,
    isPaused,
    isFinished,
    isActive,
    pause,
    resume,
    togglePause,
  };
}
