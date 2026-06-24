# Habit Session Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать дневной план сессий с распределением `free_time_min`, единый UX «Начать → таймер → ввод результата» и лимит светлых привычек в онбординге.

**Architecture:** Алгоритм плана живёт в `@mytodo/domain` (`buildDailyPlan`). API хранит сессии в новой таблице `habit_sessions`, при завершении накапливает `checkin.value`. Web рендерит `DailyPlanList` + `FocusScreen` поверх существующего `HomePage`. Pomodoro-роуты остаются как thin-wrapper над sessions для обратной совместимости.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, Fastify, React 19, TanStack Query, Zod (`@mytodo/shared`).

**Spec:** `docs/superpowers/specs/2026-06-24-habit-session-plan-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/constants/sessions.ts` | Session/budget constants, `maxLightHabitsForBudget` |
| `packages/shared/src/constants.ts` | `computeDailyBudgetMin` без cap 60 |
| `packages/shared/src/schemas/daily-plan.ts` | Zod: `DailyPlanBlock`, `dailyPlanSchema` |
| `packages/shared/src/schemas/habit-session.ts` | Zod: start/complete/active session |
| `packages/domain/src/habits/daily-plan.ts` | `goalToMinutes`, `buildDailyPlan`, round-robin |
| `packages/domain/src/habits/daily-plan.test.ts` | Unit tests |
| `apps/api/drizzle/0014_habit_sessions.sql` | Migration |
| `apps/api/src/db/schema/index.ts` | `habitSessions` table |
| `apps/api/src/services/habit-sessions.ts` | Start/complete/stop sessions |
| `apps/api/src/services/checkins.ts` | `applySessionValue` (generic accumulate) |
| `apps/api/src/routes/habit-sessions.ts` | REST endpoints |
| `apps/api/src/services/today.ts` | Attach `daily_plan` to responses |
| `apps/api/src/services/habits.ts` | Light-habit count validation |
| `apps/web/src/features/sessions/*` | Timer hook, FocusScreen, ValuePrompt |
| `apps/web/src/features/today/DailyPlanList.tsx` | Plan UI |
| `apps/web/src/features/today/HabitTaskCard.tsx` | Progress + manual entry fallback |
| `apps/web/src/pages/HomePage/HomePage.tsx` | Wire plan + focus overlay |
| `apps/web/src/pages/OnboardingPage/LightPathStep.tsx` | Time-based habit limit |
| `apps/web/src/lib/demo-api.ts` | Local plan + sessions |

---

### Task 1: Shared constants and budget cap removal

**Files:**
- Create: `packages/shared/src/constants/sessions.ts`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/constants.test.ts`

- [ ] **Step 1: Write failing test for new constants**

```ts
// packages/shared/src/constants/sessions.test.ts
import { describe, expect, it } from "vitest";
import {
  MIN_MINUTES_PER_LIGHT_HABIT,
  maxLightHabitsForBudget,
} from "./sessions.js";

describe("maxLightHabitsForBudget", () => {
  it("returns floor of free time divided by minimum per habit", () => {
    expect(maxLightHabitsForBudget(15)).toBe(1);
    expect(maxLightHabitsForBudget(30)).toBe(3);
    expect(maxLightHabitsForBudget(60)).toBe(6);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @mytodo/shared test`
Expected: FAIL — module `./sessions.js` not found

- [ ] **Step 3: Implement constants**

```ts
// packages/shared/src/constants/sessions.ts
import { MAX_ACTIVE_HABITS } from "./habits.js";

export const MIN_MINUTES_PER_LIGHT_HABIT = 10;
export const SESSION_MIN_MIN = 10;
export const SESSION_MAX_MIN = 15;
export const SESSION_TARGET_MIN = 12;
export const AWARENESS_SESSION_MIN = 5;
export const LESSON_MINUTES_ESTIMATE = 15;

export function maxLightHabitsForBudget(freeTimeMin: number): number {
  if (freeTimeMin < MIN_MINUTES_PER_LIGHT_HABIT) return 0;
  return Math.min(
    MAX_ACTIVE_HABITS,
    Math.floor(freeTimeMin / MIN_MINUTES_PER_LIGHT_HABIT),
  );
}
```

```ts
// packages/shared/src/constants.ts — change computeDailyBudgetMin
export function computeDailyBudgetMin(freeTimeMin: number): number {
  return freeTimeMin;
}
```

Export from `packages/shared/src/index.ts`.

- [ ] **Step 4: Update `constants.test.ts`**

```ts
it("uses full free time as daily budget", () => {
  expect(computeDailyBudgetMin(90)).toBe(90);
  expect(computeDailyBudgetMin(120)).toBe(120);
});
```

Remove old "caps budget at 60" test.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @mytodo/shared test`
Expected: PASS

- [ ] **Step 6: Fix API tests that assumed cap 60**

Modify: `apps/api/test/auth.test.ts` — test `"caps daily_budget_min at 60"` → expect `120` when `free_time_min: 120`.

Run: `pnpm --filter @mytodo/api test -- auth.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/shared apps/api/test/auth.test.ts
git commit -m "feat(shared): session constants and remove 60-min budget cap"
```

---

### Task 2: Domain daily-plan module (TDD)

**Files:**
- Create: `packages/domain/src/habits/daily-plan.ts`
- Create: `packages/domain/src/habits/daily-plan.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/domain/src/habits/daily-plan.test.ts
import { describe, expect, it } from "vitest";
import { buildDailyPlan, goalToMinutes, minutesToExpectedYield } from "./daily-plan.js";

describe("goalToMinutes", () => {
  it("converts pages at 2 pages per minute", () => {
    expect(goalToMinutes("pages", 10)).toBe(5);
  });
  it("converts reps at 2 seconds each", () => {
    expect(goalToMinutes("reps", 30)).toBe(1);
  });
});

describe("buildDailyPlan", () => {
  const habits = [
    { id: "h1", name: "Книги", icon: null, unit: "pages" as const, current_goal: 20, checkin_value: 0 },
    { id: "h2", name: "Бег", icon: null, unit: "minutes" as const, current_goal: 15, checkin_value: 0 },
  ];

  it("returns empty blocks when all goals met", () => {
    const plan = buildDailyPlan({
      date: "2026-06-24",
      budgetMin: 60,
      habits: habits.map((h) => ({ ...h, checkin_value: h.current_goal })),
    });
    expect(plan.blocks).toHaveLength(0);
  });

  it("scales down when total needed exceeds budget", () => {
    const plan = buildDailyPlan({ date: "2026-06-24", budgetMin: 10, habits });
    const planned = plan.blocks.reduce((s, b) => s + b.duration_min, 0);
    expect(planned).toBeLessThanOrEqual(10);
  });

  it("orders blocks round-robin across habits", () => {
    const plan = buildDailyPlan({ date: "2026-06-24", budgetMin: 60, habits });
    const ids = plan.blocks.map((b) => b.habit_id);
    if (ids.length >= 2) {
      expect(ids[0]).not.toBe(ids[1]);
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @mytodo/domain test -- daily-plan`
Expected: FAIL

- [ ] **Step 3: Implement `daily-plan.ts`**

Key exports:

```ts
export type HabitPlanInput = {
  id: string;
  name: string;
  icon: string | null;
  unit: HabitUnit;
  current_goal: number;
  checkin_value: number;
};

export type DailyPlanBlock = {
  id: string;
  habit_id: string;
  habit_name: string;
  icon: string | null;
  unit: HabitUnit;
  duration_min: number;
  expected_yield: number;
  order: number;
  status: "pending" | "active" | "completed";
  actual_value: number | null;
  actual_minutes: number | null;
};

export type DailyPlan = {
  blocks: DailyPlanBlock[];
  minutes_planned: number;
  minutes_completed: number;
  minutes_remaining: number;
};

export function goalToMinutes(unit: HabitUnit, goal: number): number { /* per spec §3 */ }
export function minutesToExpectedYield(unit: HabitUnit, minutes: number): number { /* inverse */ }

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function blockId(date: string, habitId: string, index: number): string {
  return `${date}:${habitId}:${index}`;
}

export function buildDailyPlan(input: {
  date: string;
  budgetMin: number;
  habits: HabitPlanInput[];
  completedBlockIds?: Set<string>;
  activeBlockId?: string | null;
}): DailyPlan { /* algorithm from spec §4 */ }
```

`minutes_completed` = sum of `actual_minutes` on completed blocks (from sessions when integrated in API).

- [ ] **Step 4: Export from `packages/domain/src/index.ts`**

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @mytodo/domain test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): daily plan builder with weighted time allocation"
```

---

### Task 3: Shared Zod schemas

**Files:**
- Create: `packages/shared/src/schemas/daily-plan.ts`
- Create: `packages/shared/src/schemas/habit-session.ts`
- Modify: `packages/shared/src/schemas/today.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add schemas**

```ts
// packages/shared/src/schemas/daily-plan.ts
import { z } from "zod";
import { habitUnitSchema } from "./habits.js";

export const dailyPlanBlockStatusSchema = z.enum(["pending", "active", "completed"]);

export const dailyPlanBlockSchema = z.object({
  id: z.string(),
  habit_id: z.string().uuid(),
  habit_name: z.string(),
  icon: z.string().nullable(),
  unit: habitUnitSchema,
  duration_min: z.number().int().positive(),
  expected_yield: z.number(),
  order: z.number().int().min(0),
  status: dailyPlanBlockStatusSchema,
  actual_value: z.number().nullable(),
  actual_minutes: z.number().int().nullable(),
});

export const dailyPlanSchema = z.object({
  blocks: z.array(dailyPlanBlockSchema),
  minutes_planned: z.number().int().min(0),
  minutes_completed: z.number().int().min(0),
  minutes_remaining: z.number().int().min(0),
});
```

```ts
// packages/shared/src/schemas/habit-session.ts
export const habitSessionSchema = z.object({
  id: z.string().uuid(),
  habit_id: z.string().uuid(),
  block_id: z.string().nullable(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  planned_min: z.number().int().positive(),
  actual_min: z.number().int().nullable(),
  value_added: z.number().nullable(),
  completed: z.boolean(),
  remaining_seconds: z.number().int().min(0).optional(),
});

export const startHabitSessionRequestSchema = z.object({
  block_id: z.string().optional(),
  planned_min: z.number().int().positive().optional(),
});

export const completeHabitSessionRequestSchema = z.object({
  block_id: z.string().optional(),
  actual_value: z.number().min(0).optional(),
  ended_early: z.boolean().optional(),
});
```

- [ ] **Step 2: Extend today schemas**

```ts
// todayLightResponseSchema — add field
daily_plan: dailyPlanSchema,

// todayDarkResponseSchema — add optional
daily_plan: dailyPlanSchema.optional(),
```

- [ ] **Step 3: Build shared package**

Run: `pnpm --filter @mytodo/shared build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): daily plan and habit session schemas"
```

---

### Task 4: Database migration and Drizzle schema

**Files:**
- Create: `apps/api/drizzle/0014_habit_sessions.sql`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Write migration SQL**

```sql
CREATE TABLE "habit_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "habit_id" uuid NOT NULL REFERENCES "habits"("id") ON DELETE CASCADE,
  "block_id" text,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "ended_at" timestamptz,
  "planned_min" integer NOT NULL,
  "actual_min" integer,
  "value_added" numeric,
  "completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "habit_sessions_habit_idx" ON "habit_sessions" ("habit_id");
CREATE UNIQUE INDEX "habit_sessions_one_active_per_habit"
  ON "habit_sessions" ("habit_id")
  WHERE "completed" = false AND "ended_at" IS NULL;
```

- [ ] **Step 2: Add Drizzle table** (mirror `pomodoroSessions` pattern in `schema/index.ts`)

```ts
export const habitSessions = pgTable("habit_sessions", { /* columns */ });
export type HabitSession = typeof habitSessions.$inferSelect;
```

- [ ] **Step 3: Run migration locally**

Run: `pnpm db:migrate`
Expected: migration applies without error

- [ ] **Step 4: Commit**

```bash
git add apps/api/drizzle/0014_habit_sessions.sql apps/api/src/db/schema/index.ts
git commit -m "feat(api): habit_sessions table"
```

---

### Task 5: HabitSessionService + checkin accumulation

**Files:**
- Create: `apps/api/src/services/habit-sessions.ts`
- Modify: `apps/api/src/services/checkins.ts`
- Create: `apps/api/test/habit-sessions.test.ts`

- [ ] **Step 1: Write failing API test**

```ts
// apps/api/test/habit-sessions.test.ts — pattern from pomodoro.test.ts
it("starts, completes with manual value, and accumulates checkin for books", async () => {
  const auth = await createOnboardedUser("sessions-books@example.com");
  const habit = await createBooksHabit(auth.access_token); // baseline 5 pages

  const start = await app.inject({
    method: "POST",
    url: `/api/v1/habits/${habit.id}/sessions/start`,
    headers: { authorization: `Bearer ${auth.access_token}` },
    payload: { planned_min: 10, block_id: "2026-06-24:test:0" },
  });
  expect(start.statusCode).toBe(201);

  const complete = await app.inject({
    method: "POST",
    url: `/api/v1/habits/${habit.id}/sessions/complete`,
    headers: { authorization: `Bearer ${auth.access_token}` },
    payload: { actual_value: 8 },
  });
  expect(complete.statusCode).toBe(200);
  const body = habitSessionCompleteResponseSchema.parse(JSON.parse(complete.body));
  expect(body.checkin.value).toBe(8);
});
```

Add `habitSessionCompleteResponseSchema` to shared if needed.

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @mytodo/api test -- habit-sessions`
Expected: FAIL — 404 route

- [ ] **Step 3: Add `applySessionValue` to CheckinService**

```ts
async applySessionValue(user: User, habitId: string, valueToAdd: number) {
  const habit = await this.getOwnedHabit(user.id, habitId);
  const date = getUserLocalDate(new Date(), user.timezone);
  const existing = await this.findExistingCheckin(habit.id, date);
  const currentValue = existing?.value == null ? 0 : Number(existing.value);
  const newValue = currentValue + valueToAdd;
  const status = resolveCheckinStatus(this.toCheckinHabit(habit), { value: newValue });
  const checkin = await this.saveCheckin(habit.id, date, status, newValue);
  // ... pledge/push same as applySessionMinutes
  return { date, status: checkin.status, value: newValue, current_goal, preview_next_goal };
}
```

Refactor `applySessionMinutes` to call `applySessionValue`.

- [ ] **Step 4: Implement HabitSessionService**

```ts
export class HabitSessionService {
  async start(user: User, habitId: string, opts: { blockId?: string; plannedMin?: number }) {
    // reject if active session exists
    // plannedMin defaults: awareness 5, doom-scroll delegates to DoomScrollService, else block or SESSION_TARGET_MIN
    // insert habit_sessions row
  }

  async complete(user: User, habitId: string, opts: { blockId?: string; actualValue?: number; endedEarly?: boolean }) {
    // compute actualMin from elapsed (ceil minutes)
    // if unit === 'minutes' → valueToAdd = actualMin
    // else valueToAdd = opts.actualValue ?? 0 (require for non-minutes)
    // applySessionValue
    // mark session completed
  }

  async stop(userId, habitId) { /* early end without value — or triggers complete with ended_early */ }

  async getActive(userId, habitId) { /* with remaining_seconds via computeRemainingSeconds */ }

  async listCompletedBlockIdsForDate(userId, date, timezone): Promise<Set<string>>
}
```

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Add minutes-auto test for running habit**

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/habit-sessions.ts apps/api/src/services/checkins.ts apps/api/test/habit-sessions.test.ts
git commit -m "feat(api): habit session service with cumulative checkins"
```

---

### Task 6: REST routes and app registration

**Files:**
- Create: `apps/api/src/routes/habit-sessions.ts`
- Modify: `apps/api/src/app.ts` (or wherever routes are registered)

- [ ] **Step 1: Register routes**

```ts
POST /api/v1/habits/:id/sessions/start
POST /api/v1/habits/:id/sessions/complete
POST /api/v1/habits/:id/sessions/stop
GET  /api/v1/habits/:id/sessions/active
```

Wire `HabitSessionService` in app bootstrap (same pattern as `PomodoroService`).

- [ ] **Step 2: Run habit-sessions tests**

Run: `pnpm --filter @mytodo/api test -- habit-sessions`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/habit-sessions.ts apps/api/src/app.ts
git commit -m "feat(api): habit session REST endpoints"
```

---

### Task 7: TodayService — attach daily_plan

**Files:**
- Modify: `apps/api/src/services/today.ts`
- Modify: `apps/api/test/today.test.ts`

- [ ] **Step 1: Write failing today test**

```ts
it("includes daily_plan for light dashboard", async () => {
  // onboard with 60 min, create 2 light habits
  const body = todayLightResponseSchema.parse(JSON.parse(response.body));
  expect(body.daily_plan).toBeDefined();
  expect(body.daily_plan.minutes_planned).toBeGreaterThan(0);
  expect(body.daily_plan.blocks.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Implement in TodayService**

```ts
import { buildDailyPlan } from "@mytodo/domain";

// in getLightDashboard:
const completedBlocks = await this.habitSessionService.listCompletedBlockIdsForDate(...);
const activeSession = /* any active across habits */;

const dailyPlan = buildDailyPlan({
  date: today,
  budgetMin: user.dailyBudgetMin,
  habits: userHabits.filter(h => h.side === "light").map(h => ({
    id: h.id,
    name: h.name,
    icon: h.icon,
    unit: h.unit,
    current_goal: Number(h.currentGoal),
    checkin_value: todayCheckins.get(h.id)?.value ?? 0,
  })),
  completedBlockIds: completedBlocks,
  activeBlockId: activeSession?.blockId ?? null,
});

// merge actual_minutes/value from completed sessions into block status
```

For dark dashboard: build plan only for `limit` habits (awareness 5 min blocks; social_media uses doom-scroll blocks with 15 min).

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @mytodo/api test -- today.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/today.ts apps/api/test/today.test.ts
git commit -m "feat(api): include daily_plan in today responses"
```

---

### Task 8: Server-side light habit limit on create

**Files:**
- Modify: `apps/api/src/services/habits.ts`
- Modify: `apps/api/test/habits.test.ts`

- [ ] **Step 1: Write failing test**

```ts
it("rejects light habit when free time budget is exhausted", async () => {
  const auth = await createOnboardedUserWithFreeTime("limit@example.com", 15);
  await createBooksHabit(auth.access_token);
  const second = await app.inject({
    method: "POST",
    url: "/api/v1/habits",
    headers: { authorization: `Bearer ${auth.access_token}` },
    payload: { template_id: "running", baseline_value: 10 },
  });
  expect(second.statusCode).toBe(400);
});
```

- [ ] **Step 2: Implement in HabitService.create**

```ts
import { maxLightHabitsForBudget } from "@mytodo/shared";

if (template.side === "light" || isCustomLight) {
  const activeLight = await this.countActiveLightHabits(user.id);
  const max = maxLightHabitsForBudget(user.freeTimeMin ?? 0);
  if (activeLight >= max) {
    throw new ApiError(400, VALIDATION_ERROR, "Слишком много полезных привычек для выбранного времени");
  }
}
```

- [ ] **Step 3: Run tests — PASS**

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/habits.ts apps/api/test/habits.test.ts
git commit -m "feat(api): enforce light habit limit from free time"
```

---

### Task 9: Onboarding UI — time-based habit limit

**Files:**
- Modify: `apps/web/src/pages/OnboardingPage/OnboardingPage.tsx`
- Modify: `apps/web/src/pages/OnboardingPage/LightPathStep.tsx`
- Modify: `apps/web/src/pages/OnboardingPage/OnboardingPage.css` (hint styles if needed)

- [ ] **Step 1: Pass `freeTimeMin` and `maxLightHabits` into LightPathStep**

```tsx
// OnboardingPage.tsx
import { maxLightHabitsForBudget } from "@mytodo/shared";

const maxLightHabits = maxLightHabitsForBudget(body.freeTimeMin);

<LightPathStep
  lightHabits={lightHabits}
  maxLightHabits={maxLightHabits}
  freeTimeMin={body.freeTimeMin}
  ...
/>
```

- [ ] **Step 2: Block selection in LightPathStep**

In `toggleLightActivity` handler:

```tsx
if (!existing && lightHabits.filter(isCompleteLightHabit).length >= maxLightHabits) {
  return; // do not add
}
```

Disable activity cards when at limit. Show banner:

```tsx
<p className="onboarding__time-limit-hint" role="status">
  При {freeTimeMin} мин в день — не больше {maxLightHabits} полезных привычек.
</p>
```

When user lowers `freeTimeMin` slider below threshold for current selection, show validation error on «Далее».

- [ ] **Step 3: Manual smoke test**

Run: `pnpm --filter @mytodo/web dev`
Verify: 15 min → cannot pick 2nd light habit.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/OnboardingPage
git commit -m "feat(web): onboarding light habit limit from free time"
```

---

### Task 10: Web API client and session hooks

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/features/sessions/useHabitSession.ts`
- Create: `apps/web/src/features/sessions/session-api.ts`

- [ ] **Step 1: Add API functions**

```ts
export async function startHabitSession(habitId: string, body: StartHabitSessionRequest) { ... }
export async function completeHabitSession(habitId: string, body: CompleteHabitSessionRequest) { ... }
export async function stopHabitSession(habitId: string) { ... }
export async function getActiveHabitSession(habitId: string) { ... }
```

Demo equivalents in `demo-api.ts` (Task 13).

- [ ] **Step 2: Create `useHabitSession` mutation hook**

Invalidates `["today", side]` on complete.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/features/sessions
git commit -m "feat(web): habit session API client and hooks"
```

---

### Task 11: FocusScreen, ValuePrompt, useSessionTimer

**Files:**
- Create: `apps/web/src/features/sessions/useSessionTimer.ts`
- Create: `apps/web/src/features/sessions/FocusScreen.tsx`
- Create: `apps/web/src/features/sessions/FocusScreen.css`
- Create: `apps/web/src/features/sessions/ValuePrompt.tsx`

- [ ] **Step 1: `useSessionTimer`**

Web Worker or `setInterval` countdown from `planned_min * 60` seconds. Expose: `remainingSec`, `isRunning`, `pause`, `resume`, `elapsedMin` (ceil).

- [ ] **Step 2: `FocusScreen`**

Props: `habitName`, `plannedMin`, `onComplete(elapsedMin)`, `onEarlyEnd(elapsedMin)`.

Fullscreen overlay with `MM:SS`, buttons «Пауза» / «Закончил раньше».

- [ ] **Step 3: `ValuePrompt`**

Modal: number input, label from `formatUnit`, hint `~{expected_yield}`, submit calls `completeHabitSession`.

Skip modal when `unit === "minutes"` — auto-complete with `elapsedMin`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/sessions
git commit -m "feat(web): focus timer and value prompt for sessions"
```

---

### Task 12: DailyPlanList + HomePage integration

**Files:**
- Create: `apps/web/src/features/today/DailyPlanList.tsx`
- Modify: `apps/web/src/pages/HomePage/HomePage.tsx`
- Modify: `apps/web/src/pages/HomePage/HomePage.css`
- Modify: `apps/web/src/features/today/HabitTaskCard.tsx`

- [ ] **Step 1: `DailyPlanList`**

Renders progress bar (`minutes_completed / daily_budget_min`), list of blocks with [Начать] button.

State: `activeBlock` → opens `FocusScreen`.

On timer end → `ValuePrompt` or auto-complete.

- [ ] **Step 2: Wire HomePage**

```tsx
// After stats section, before habit cards:
{isLightDashboard(dashboard) && dashboard.daily_plan ? (
  <DailyPlanList
    plan={dashboard.daily_plan}
    side={side}
    habits={habits}
  />
) : null}
```

Dark side: render plan only when `dashboard.daily_plan` present (limit habits).

- [ ] **Step 3: Simplify HabitTaskCard**

- Remove primary slider UI.
- Show `value / current_goal` progress bar.
- Add «Ввести вручную» ghost button → small modal with slider (reuse existing checkin mutation).

Keep abstinence «Сорвался» unchanged.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/today apps/web/src/pages/HomePage
git commit -m "feat(web): daily plan list and session flow on home"
```

---

### Task 13: Demo mode parity

**Files:**
- Modify: `apps/web/src/lib/demo-api.ts`

- [ ] **Step 1: In-memory habit sessions store**

Mirror `habit_sessions` shape in demo state.

- [ ] **Step 2: `demoGetTodayLight` / `demoGetTodayDark`**

Call `buildDailyPlan` from `@mytodo/domain` with demo habits/checkins.

- [ ] **Step 3: Implement start/complete/stop in demo API**

Wire through `api.ts` when `isDemoMode()`.

- [ ] **Step 4: Smoke test demo mode**

Run: `pnpm --filter @mytodo/web dev` with demo flag
Verify plan renders and session completes without backend.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/demo-api.ts apps/web/src/lib/api.ts
git commit -m "feat(web): demo mode support for daily plan and sessions"
```

---

### Task 14: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: all packages PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Manual checklist (spec §13)**

- [ ] 15 min + 1 light habit — onboarding blocks 2nd
- [ ] 60 min + 3 light — plan ≤ budget, round-robin
- [ ] Books session → value accumulates
- [ ] Running session → auto minutes
- [ ] Abstinence unchanged
- [ ] Demo mode works offline

- [ ] **Step 4: Commit any fixes**

```bash
git commit -m "fix: session plan integration polish"
```

---

## Spec coverage checklist

| Spec section | Task |
|--------------|------|
| §2 Budget cap removal | Task 1 |
| §2 Constants | Task 1 |
| §3 goalToMinutes | Task 2 |
| §4 buildDailyPlan | Task 2, 7 |
| §5 Session flow | Task 5, 11, 12 |
| §6 Onboarding limit | Task 8, 9 |
| §7 UI | Task 11, 12 |
| §8 API | Task 3, 4, 5, 6, 7 |
| §9 Domain module | Task 2 |
| §10 Demo | Task 13 |
| §11 Out of scope | — |

---

## Notes for implementers

- **Pomodoro routes:** keep working; optionally delegate `PomodoroService.start` to `HabitSessionService` with `plannedMin = user.pomodoroWorkMin` to avoid duplicate tables long-term.
- **Doom scroll:** `social_media` sessions should continue using `DoomScrollService`; include those blocks in dark `daily_plan` by reading active/completed doom sessions.
- **Block ID stability:** use `buildDailyPlan`'s deterministic `blockId(date, habitId, index)` so client and server agree without persisting the plan.
- **minutes_logged_today:** continue summing `unit === "minutes"` checkin values; also add `actual_minutes` from completed non-minute sessions to a separate counter only if product wants timer time counted — for v1, only minute-unit habits increment `minutes_logged_today` per existing `TodayService.sumMinutesToday`.
