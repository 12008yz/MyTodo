import { useEffect, useState } from "react";

export type CalendarSlideDirection = "left" | "right" | "none";

export const CALENDAR_SLIDE_DURATION_MS = 520;

export function useCalendarMonthSlide() {
  const [slideDirection, setSlideDirection] = useState<CalendarSlideDirection>("none");

  const beginSlide = (delta: -1 | 1) => {
    setSlideDirection(delta > 0 ? "right" : "left");
  };

  useEffect(() => {
    if (slideDirection === "none") {
      return;
    }

    const timer = window.setTimeout(() => {
      setSlideDirection("none");
    }, CALENDAR_SLIDE_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [slideDirection]);

  return { slideDirection, beginSlide };
}

export function calendarSlideClass(
  base: string,
  direction: CalendarSlideDirection,
): string {
  if (direction === "none") {
    return base;
  }
  return `${base} ${base}--from-${direction}`;
}
