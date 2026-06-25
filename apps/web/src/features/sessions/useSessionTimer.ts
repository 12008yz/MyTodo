import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

type UseSessionTimerOptions = {
  sessionKey: string | null;
  plannedMin: number;
  initialRemainingSeconds?: number;
  autoStart?: boolean;
};

export function useSessionTimer({
  sessionKey,
  plannedMin,
  initialRemainingSeconds,
  autoStart = true,
}: UseSessionTimerOptions) {
  const totalSeconds = Math.max(1, Math.round(plannedMin * 60));
  const isActive = Boolean(sessionKey);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [armed, setArmed] = useState(false);

  useLayoutEffect(() => {
    if (!sessionKey) {
      setRemainingSeconds(0);
      setIsPaused(true);
      setArmed(false);
      return;
    }

    const nextRemaining =
      initialRemainingSeconds != null && initialRemainingSeconds > 0
        ? Math.min(initialRemainingSeconds, totalSeconds)
        : totalSeconds;

    setRemainingSeconds(nextRemaining);
    setIsPaused(!autoStart);
    setArmed(true);
  }, [autoStart, initialRemainingSeconds, sessionKey, totalSeconds]);

  useEffect(() => {
    if (!armed || isPaused || remainingSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [armed, isPaused, remainingSeconds]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const togglePause = useCallback(() => setIsPaused((value) => !value), []);

  const elapsedSeconds = Math.max(totalSeconds - remainingSeconds, 0);
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
