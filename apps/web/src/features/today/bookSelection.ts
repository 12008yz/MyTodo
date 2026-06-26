import { BOOK_RECOMMENDATIONS } from "./bookRecommendations";

const STORAGE_PREFIX = "mytodo:selected-book:";

export type SelectedBook = {
  id: string;
  title: string;
  author: string;
};

type StoredBookState = SelectedBook & {
  pagesRead: number;
  progressDate: string | null;
  todayPagesIncluded: number;
};

function readStoredState(habitId: string): StoredBookState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${habitId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBookState>;
    if (!parsed?.id) return null;
    const known = BOOK_RECOMMENDATIONS.find((book) => book.id === parsed.id);
    if (!known) {
      localStorage.removeItem(`${STORAGE_PREFIX}${habitId}`);
      return null;
    }
    return {
      id: known.id,
      title: known.title,
      author: known.author,
      pagesRead: typeof parsed.pagesRead === "number" ? parsed.pagesRead : 0,
      progressDate: typeof parsed.progressDate === "string" ? parsed.progressDate : null,
      todayPagesIncluded:
        typeof parsed.todayPagesIncluded === "number" ? parsed.todayPagesIncluded : 0,
    };
  } catch {
    return null;
  }
}

function writeStoredState(habitId: string, state: StoredBookState): void {
  localStorage.setItem(`${STORAGE_PREFIX}${habitId}`, JSON.stringify(state));
}

export function readSelectedBook(habitId: string): SelectedBook | null {
  const state = readStoredState(habitId);
  if (!state) return null;
  return { id: state.id, title: state.title, author: state.author };
}

export type WriteSelectedBookOptions = {
  planDate?: string;
  /** Страницы из сегодняшнего чекина до выбора книги — не засчитываются в новую книгу. */
  checkinBaseline?: number;
};

export function writeSelectedBook(
  habitId: string,
  book: SelectedBook,
  options?: WriteSelectedBookOptions,
): void {
  const existing = readStoredState(habitId);
  if (existing?.id === book.id) {
    writeStoredState(habitId, { ...existing, title: book.title, author: book.author });
    return;
  }
  const planDate = options?.planDate;
  const checkinBaseline = Math.max(0, options?.checkinBaseline ?? 0);
  writeStoredState(habitId, {
    ...book,
    pagesRead: 0,
    progressDate: planDate ?? null,
    todayPagesIncluded: planDate ? checkinBaseline : 0,
  });
}

export function clearSelectedBook(habitId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${habitId}`);
}

export function getBookPageCount(bookId: string): number | null {
  return BOOK_RECOMMENDATIONS.find((book) => book.id === bookId)?.pageCount ?? null;
}

/** Сколько страниц книги уже «засчитано» с учётом сегодняшнего чекина и текущей сессии. */
export function computeEffectivePagesRead(
  habitId: string,
  todayDate: string,
  checkinValue: number,
  liveSessionPages: number,
): number {
  const state = readStoredState(habitId);
  if (!state) return 0;

  const todayTotal = checkinValue + liveSessionPages;
  if (state.progressDate !== todayDate) {
    return state.pagesRead + todayTotal;
  }

  return state.pagesRead + Math.max(0, todayTotal - state.todayPagesIncluded);
}

/** Сохраняет прогресс по книге из подтверждённого чекина (кнопка +, завершение сессии). */
export function persistBookCheckinProgress(
  habitId: string,
  todayDate: string,
  checkinValue: number,
): void {
  const state = readStoredState(habitId);
  if (!state) return;

  let { pagesRead, progressDate, todayPagesIncluded } = state;

  if (progressDate !== todayDate) {
    progressDate = todayDate;
    todayPagesIncluded = 0;
  }

  if (checkinValue > todayPagesIncluded) {
    pagesRead += checkinValue - todayPagesIncluded;
    todayPagesIncluded = checkinValue;
  }

  writeStoredState(habitId, {
    ...state,
    pagesRead,
    progressDate,
    todayPagesIncluded,
  });
}
