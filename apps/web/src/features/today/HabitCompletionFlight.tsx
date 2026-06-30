import { useLayoutEffect, useRef, type ReactNode } from "react";

export type CompletionFlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function captureHabitPlanItemRect(habitId: string): CompletionFlightRect | null {
  const element = document.querySelector(
    `.home__plan-list-layer [data-habit-plan-item="${CSS.escape(habitId)}"]`,
  );
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

type HabitCompletionFlightProps = {
  fromRect: CompletionFlightRect | null;
  children: ReactNode;
};

export function HabitCompletionFlight({ fromRect, children }: HabitCompletionFlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !fromRect) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      return;
    }

    const to = element.getBoundingClientRect();
    const dx = fromRect.left - to.left;
    const dy = fromRect.top - to.top;
    const scaleX = fromRect.width / Math.max(to.width, 1);
    const scaleY = fromRect.height / Math.max(to.height, 1);

    element.style.transformOrigin = "top left";
    element.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`;
    element.style.opacity = "0.88";

    let outerFrame = 0;
    let innerFrame = 0;

    outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        element.classList.add("home__plan-item-flight--active");
        element.style.transform = "";
        element.style.opacity = "";
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
      element.classList.remove("home__plan-item-flight--active");
      element.style.transform = "";
      element.style.opacity = "";
    };
  }, [fromRect]);

  return (
    <div ref={ref} className="home__plan-item-flight">
      {children}
    </div>
  );
}
