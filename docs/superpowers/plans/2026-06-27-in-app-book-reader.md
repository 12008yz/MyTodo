# In-App Book Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan step-by-step.

**Goal:** Embed public-domain book texts as static pages and ship an in-app reader with bookmark persistence.

**Architecture:** Prepare script → static `public/books/`; `last_read_page` on API; React reader page with lazy page fetch; homepage entry point.

**Tech Stack:** Node 22 script, Drizzle migration, Fastify, React Router, existing reading progress service.

---

### Task 1: Content pipeline

**Files:**
- Create: `scripts/books/prepare-books.mjs`
- Modify: `package.json` — `"books:prepare"` script

- [ ] Download/extract texts for all 5 catalog ids
- [ ] Split to `BOOK_PAGE_COUNTS` pages
- [ ] Output to `apps/web/public/books/{id}/manifest.json` + `pages/*.txt`

### Task 2: Shared schema + migration

**Files:**
- Create: `apps/api/drizzle/0023_reading_last_page.sql`
- Modify: `apps/api/src/db/schema/index.ts`
- Modify: `packages/shared/src/schemas/reading.ts` — `last_read_page`, bookmark request schema

### Task 3: API bookmark endpoint

**Files:**
- Modify: `apps/api/src/services/reading-progress.ts`
- Modify: `apps/api/src/routes/reading.ts`
- Modify: `apps/api/test/reading.test.ts`

### Task 4: Web reader

**Files:**
- Create: `apps/web/src/features/books/bookContent.ts`
- Create: `apps/web/src/pages/BookReaderPage/BookReaderPage.tsx`
- Create: `apps/web/src/pages/BookReaderPage/BookReaderPage.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/api.ts`, `demo-api.ts`

### Task 5: Homepage integration

**Files:**
- Modify: `apps/web/src/features/today/DailyPlanHabitRow.tsx`
- Modify: `apps/web/src/pages/HomePage/HomePage.css` (reader link styles if needed)

### Task 6: Verify

- [ ] `pnpm books:prepare`
- [ ] `pnpm --filter @mytodo/api test reading`
- [ ] Manual: open reader in demo mode
