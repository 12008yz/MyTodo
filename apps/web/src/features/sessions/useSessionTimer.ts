import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseSessionTimerOptions = {
  plannedMin: number;
  autoStart?: boolean;
  onFinish?: () => void;
};

export function useSessionTimer({
  plannedMin,
  autoStart = true,
  onFinish,
}: UseSessionTimerOptions) {
  const totalSeconds = Math.max(0, Math.round(plannedMin * 60));
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [isPaused, setIsPaused] = useState(!autoStart);
  const hasNotifiedFinishRef = useRef(false);

  useEffect(() => {
    setRemainingSeconds(totalSeconds);
    setIsPaused(!autoStart);
    hasNotifiedFinishRef.current = false;
  }, [autoStart, totalSeconds]);

  useEffect(() => {
    if (isPaused || remainingSeconds <= 0) {
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
  }, [isPaused, remainingSeconds]);

  useEffect(() => {
    if (remainingSeconds === 0 && !hasNotifiedFinishRef.current) {
      hasNotifiedFinishRef.current = true;
      onFinish?.();
    }
  }, [onFinish, remainingSeconds]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const togglePause = useCallback(() => setIsPaused((value) => !value), []);

  const elapsedSeconds = Math.max(totalSeconds - remainingSeconds, 0);
  const elapsedMin = useMemo(() => {
    if (elapsedSeconds === 0) return 0;
    return Math.ceil(elapsedSeconds / 60);
  }, [elapsedSeconds]);

  return {
    remainingSeconds,
    elapsedMin,
    isPaused,
    isFinished: remainingSeconds === 0,
    pause,
    resume,
    togglePause,
  };
}
