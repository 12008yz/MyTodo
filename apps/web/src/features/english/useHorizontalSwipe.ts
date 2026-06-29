import { useCallback, useRef } from "react";

type UseHorizontalSwipeOptions = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
};

export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 48,
}: UseHorizontalSwipeOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    startX.current = event.touches[0]?.clientX ?? null;
    startY.current = event.touches[0]?.clientY ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (startX.current == null || startY.current == null) {
        return;
      }

      const endX = event.changedTouches[0]?.clientX ?? startX.current;
      const endY = event.changedTouches[0]?.clientY ?? startY.current;
      const deltaX = endX - startX.current;
      const deltaY = endY - startY.current;

      startX.current = null;
      startY.current = null;

      if (Math.abs(deltaX) < threshold || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }

      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
