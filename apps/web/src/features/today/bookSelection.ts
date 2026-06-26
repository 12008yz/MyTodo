import { BOOK_RECOMMENDATIONS } from "./bookRecommendations";

const STORAGE_PREFIX = "mytodo:selected-book:";

export type SelectedBook = {
  id: string;
  title: string;
  author: string;
};

export function readSelectedBook(habitId: string): SelectedBook | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${habitId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectedBook;
    if (!parsed?.id) return null;
    const known = BOOK_RECOMMENDATIONS.find((book) => book.id === parsed.id);
    if (!known) {
      localStorage.removeItem(`${STORAGE_PREFIX}${habitId}`);
      return null;
    }
    return { id: known.id, title: known.title, author: known.author };
  } catch {
    return null;
  }
}

export function writeSelectedBook(habitId: string, book: SelectedBook): void {
  localStorage.setItem(`${STORAGE_PREFIX}${habitId}`, JSON.stringify(book));
}

export function clearSelectedBook(habitId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${habitId}`);
}
