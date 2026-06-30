# Habit Light/Dark Data Integrity Plan

> **Goal:** Fix light/dark habit data flow bugs and prepare stats/chart contracts before building analytics UI.

**Architecture:** Align domain semantics (`type` + `phase` for abstinence), fix server aggregation/history, extend `stats/progress` contract, then update client charts and session/onboarding edge cases.

**Tech Stack:** TypeScript, Fastify, Drizzle, React, Zod, Vitest

---

## Phase 1 — Domain & server correctness
- [x] Smoking transition sets `nextType: abstinence` and day-close uses phase-aware abstinence rules
- [x] Checkins accept fail for `phase === abstinence`
- [x] Stats include inactive habits in historical aggregates
- [x] Today `completed_today` counts abstinence-on-track habits

## Phase 2 — Stats contract & charts
- [x] Extend `statsProgressResponseSchema` with `side`, `type`, `phase`, `unit`, `chart_mode`
- [ ] Update `HabitProgressChart` for target/limit/abstinence modes and null values
- [ ] Add `side` to progress query key on `ProgressPage`

## Phase 3 — Client reliability
- [ ] Stop orphan sessions on `ValuePrompt` cancel
- [ ] Fix profile pending count for abstinence habits
- [ ] Idempotent onboarding habit creation on retry

## Phase 4 — Verification
- [ ] Domain + API tests
- [ ] Build shared/domain packages
