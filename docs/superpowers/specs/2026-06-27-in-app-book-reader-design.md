# In-App Book Reader — Design

## Goal

Users read catalog books inside the app, resume at their bookmark page, and jump to any page. Habit progress (`pages_read`) stays separate from reading position (`last_read_page`).

## Load / performance

- Book text lives in `apps/web/public/books/{id}/pages/*.txt` — **not** in the JS bundle.
- Reader fetches **one page** at a time (~2–5 KB). Opening the app does not load books.
- Total static assets ~3–8 MB for all 5 books (gzip ~1–2 MB). Acceptable for PWA/static hosting.
- Regenerate via `pnpm books:prepare` (one-time / when catalog changes).

## Data model

`habit_reading_progress.last_read_page` (integer, default 1):

| Field | Meaning |
|-------|---------|
| `last_read_page` | Current position in reader (1…page_count) |
| `pages_read` | Cumulative pages credited to habit (unchanged) |

API: `PATCH /api/v1/habits/:id/reading/bookmark` `{ last_read_page: number }`

## Content pipeline

`scripts/books/prepare-books.mjs`:

1. Download plain text / extract FB2 from lib.ru / Gutenberg.
2. Clean boilerplate, normalize whitespace.
3. Split into exactly `BOOK_PAGE_COUNTS[id]` virtual pages (matches habit estimates).
4. Write `manifest.json` + `pages/001.txt` … `pages/NNN.txt`.

## UI

- Route: `/habits/:habitId/read` (auth, no bottom nav).
- Open from homepage books habit: «Читать» / «Продолжить · стр. N».
- Controls: prev/next, page input, save bookmark on change (debounced).
- Requires selected book (`reading.book_id`).

## Out of scope (v1)

- EPUB.js / reflowable EPUB
- Syncing page turns to check-in automatically
- Offline service worker cache (can add later)
