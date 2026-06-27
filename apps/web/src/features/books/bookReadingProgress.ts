import type { HabitReadingProgress } from "@mytodo/shared";

/** Сколько страниц книги прочитано сегодня относительно старта дня. */
export function pagesReadTodayInBook(
  currentPage: number,
  dayStartPage: number,
  dailyGoal: number,
): number {
  if (currentPage <= dayStartPage) {
    return 0;
  }

  return Math.min(dailyGoal, currentPage - dayStartPage + 1);
}

export function isBookDailyGoalComplete(
  currentPage: number,
  dayStartPage: number,
  dailyGoal: number,
): boolean {
  return pagesReadTodayInBook(currentPage, dayStartPage, dailyGoal) >= dailyGoal;
}

export function resolveReaderDayStartPage(
  reading: HabitReadingProgress,
  planDate: string,
): number {
  if (reading.reader_day_date === planDate && reading.reader_day_start_page != null) {
    return reading.reader_day_start_page;
  }

  return reading.last_read_page;
}
