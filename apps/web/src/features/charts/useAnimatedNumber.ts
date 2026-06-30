import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(
  target: number,
  enabled: boolean,
  durationMs = 450,
  resetKey?: string,
): number {
  const [displayValue, setDisplayValue] = useState(() => (enabled ? 0 : target));
  const displayRef = useRef(displayValue);
  displayRef.current = displayValue;
  const resetRef = useRef(resetKey);

  useEffect(() => {
    if (!enabled) {
      setDisplayValue(target);
      return;
    }

    let startValue = displayRef.current;
    if (resetKey !== resetRef.current) {
      resetRef.current = resetKey;
      startValue = 0;
      setDisplayValue(0);
    }

    if (startValue === target) {
      return;
    }

    const startTime = performance.now();
    let frameId: number | null = null;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - (1 - progress) ** 3;
      const nextValue = Math.round(startValue + (target - startValue) * eased);
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [target, durationMs, enabled, resetKey]);

  return displayValue;
}
