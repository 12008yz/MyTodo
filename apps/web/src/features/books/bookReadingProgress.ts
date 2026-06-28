import type { HabitReadingProgress } from "@mytodo/shared";

/** Сколько страниц книги прочитано сегодня относительно старта дня (без ограничения планом). */
export function pagesReadTodayInBook(currentPage: number, dayStartPage: number): number {
  if (currentPage <= dayStartPage) {
    return 0;
  }

  return currentPage - dayStartPage + 1;
}

export function isBookDailyGoalComplete(
  currentPage: number,
  dayStartPage: number,
  dailyGoal: number,
): boolean {
  return pagesReadTodayInBook(currentPage, dayStartPage) >= dailyGoal;
}

export function resolveReaderDayStartPage(
  reading: HabitReadingProgress,
  planDate: string,
): number | null {
  if (reading.reader_day_date === planDate && reading.reader_day_start_page != null) {
    return reading.reader_day_start_page;
  }

  return null;
}

export function pagesReadTodayFromProgress(
  reading: HabitReadingProgress,
  planDate: string,
): number {
  const dayStart = resolveReaderDayStartPage(reading, planDate);
  if (dayStart != null) {
    return pagesReadTodayInBook(reading.last_read_page, dayStart);
  }

  if (reading.last_checkin_date === planDate) {
    return reading.pages_credited_today;
  }

  return 0;
}

/** Сколько страниц осталось прочитать, если пользователь на `currentPage`. */
export function bookPagesRemainingFromPosition(currentPage: number, pageCount: number): number {
  return Math.max(0, pageCount - currentPage + 1);
}
