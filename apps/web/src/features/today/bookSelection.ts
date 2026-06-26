import type { HabitReadingProgress } from "@mytodo/shared";
import { BOOK_RECOMMENDATIONS } from "./bookRecommendations";

export type SelectedBook = {
  id: string;
  title: string;
  author: string;
};

export function bookFromReading(
  reading: HabitReadingProgress | null | undefined,
): SelectedBook | null {
  if (!reading) {
    return null;
  }

  const meta = BOOK_RECOMMENDATIONS.find((book) => book.id === reading.book_id);
  if (!meta) {
    return null;
  }

  return {
    id: meta.id,
    title: meta.title,
    author: meta.author,
  };
}

export function getBookPageCount(bookId: string): number | null {
  return BOOK_RECOMMENDATIONS.find((book) => book.id === bookId)?.pageCount ?? null;
}

/** Сколько страниц книги уже «засчитано» с учётом сегодняшнего чекина и текущей сессии. */
export function computeEffectivePagesRead(
  reading: HabitReadingProgress | null | undefined,
  todayDate: string,
  checkinValue: number,
  liveSessionPages: number,
): number {
  if (!reading) {
    return 0;
  }

  const todayTotal = checkinValue + liveSessionPages;
  if (reading.last_checkin_date !== todayDate) {
    return reading.pages_read + todayTotal;
  }

  return reading.pages_read + Math.max(0, todayTotal - reading.pages_credited_today);
}
