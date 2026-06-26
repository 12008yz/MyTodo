/** Known catalog book ids and page counts (UI metadata lives in the web app). */
export const BOOK_PAGE_COUNTS: Record<string, number> = {
  "kak-zakalyalas-stal": 592,
  meditations: 176,
  "self-help-smiles": 360,
  "franklin-autobiography": 188,
  "chto-delat": 488,
};

export function isKnownBookId(bookId: string): boolean {
  return bookId in BOOK_PAGE_COUNTS;
}

export function getKnownBookPageCount(bookId: string): number | null {
  return BOOK_PAGE_COUNTS[bookId] ?? null;
}
