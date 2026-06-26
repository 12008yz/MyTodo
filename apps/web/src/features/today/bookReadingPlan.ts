import { BOOKS_START_PAGES, LIGHT_GROWTH_INTERVAL_DAYS } from "@mytodo/shared";

/** Сколько дней уйдёт на книгу при ежедневной цели с ростом +1 каждые 3 успешных дня. */
export function estimateDaysAtHabitGoal(params: {
  pageCount: number;
  startPagesPerDay: number;
  growthStep?: number;
  intervalDays?: number;
  successDaysAtGoal?: number;
}): number {
  const {
    pageCount,
    startPagesPerDay,
    growthStep = 1,
    intervalDays = LIGHT_GROWTH_INTERVAL_DAYS,
    successDaysAtGoal = 0,
  } = params;

  if (pageCount <= 0) return 0;

  let remaining = pageCount;
  let goal = Math.max(1, startPagesPerDay);
  let days = 0;
  let successAtGoal = Math.max(0, successDaysAtGoal);

  while (remaining > 0 && days < 730) {
    days += 1;
    remaining -= goal;
    successAtGoal += 1;
    if (successAtGoal >= intervalDays) {
      goal += growthStep;
      successAtGoal = 0;
    }
  }

  return days;
}

export function formatDaysCount(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  let word = "дней";
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = "день";
    else if (mod10 >= 2 && mod10 <= 4) word = "дня";
  }
  return `${days} ${word}`;
}

export type HabitBookEstimate = {
  pageCount: number;
  finishDays: number;
};

export function buildHabitBookEstimate(params: {
  pageCount: number;
  currentGoal: number;
  growthStep: number;
  intervalDays: number;
  successDaysAtGoal?: number;
}): HabitBookEstimate {
  const currentPagesPerDay = Math.max(1, params.currentGoal);
  return {
    pageCount: params.pageCount,
    finishDays: estimateDaysAtHabitGoal({
      pageCount: params.pageCount,
      startPagesPerDay: currentPagesPerDay,
      growthStep: params.growthStep,
      intervalDays: params.intervalDays,
      successDaysAtGoal: params.successDaysAtGoal,
    }),
  };
}

/** Полный срок чтения книги с нуля по стандартным правилам привычки. */
export function buildGeneralBookEstimate(pageCount: number): HabitBookEstimate {
  return buildHabitBookEstimate({
    pageCount,
    currentGoal: BOOKS_START_PAGES,
    growthStep: 1,
    intervalDays: LIGHT_GROWTH_INTERVAL_DAYS,
    successDaysAtGoal: 0,
  });
}

/** Примерное время чтения всей книги (каталог). */
export function formatHabitBookReadingTime(estimate: HabitBookEstimate): string {
  return `≈${formatDaysCount(estimate.finishDays)} чтения`;
}

/** Примерный оставшийся срок (выпадающий блок). */
export function formatHabitBookRemainingTime(estimate: HabitBookEstimate): string {
  return `≈${formatDaysCount(estimate.finishDays)} осталось`;
}

export function formatBookFinishedLabel(): string {
  return "Книга прочитана";
}
