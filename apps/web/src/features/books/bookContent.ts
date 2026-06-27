export type BookManifest = {
  id: string;
  title: string;
  author: string;
  pageCount: number;
};

export async function fetchBookManifest(bookId: string): Promise<BookManifest> {
  const response = await fetch(`/books/${bookId}/manifest.json`);
  if (!response.ok) {
    throw new Error("Книга не найдена");
  }
  return response.json() as Promise<BookManifest>;
}

export async function fetchBookPage(bookId: string, page: number): Promise<string> {
  const pageId = String(page).padStart(3, "0");
  const response = await fetch(`/books/${bookId}/pages/${pageId}.txt`);
  if (!response.ok) {
    throw new Error("Страница не найдена");
  }
  return response.text();
}

export function clampBookPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, page), pageCount);
}
