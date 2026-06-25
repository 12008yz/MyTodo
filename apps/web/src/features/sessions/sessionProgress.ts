import { BOOKS_PAGES_PER_MIN, type HabitUnit } from "@mytodo/shared";

const BOOKS_SECONDS_PER_PAGE = 60 / BOOKS_PAGES_PER_MIN;

export function getLiveSessionProgress(unit: HabitUnit, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) {
    return 0;
  }

  if (unit === "minutes") {
    return elapsedSeconds / 60;
  }

  if (unit === "pages") {
    return elapsedSeconds / BOOKS_SECONDS_PER_PAGE;
  }

  return 0;
}

export function getLiveSessionProgressLabel(unit: HabitUnit, elapsedSeconds: number): number {
  const progress = getLiveSessionProgress(unit, elapsedSeconds);
  if (progress <= 0) {
    return 0;
  }

  if (unit === "minutes") {
    return progress;
  }

  return Math.floor(progress);
}
