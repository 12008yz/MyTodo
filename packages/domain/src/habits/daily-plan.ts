import {
  BOOKS_PAGES_PER_MIN,
  LESSON_MINUTES_ESTIMATE,
  PUSHUP_SECONDS_PER_REP,
  sessionBudgetMinutes,
  sortLightHabitsForDisplay,
  type HabitTemplateId,
  type HabitUnit,
} from "@mytodo/shared";
import { isEarlyRiseActivity, resolveLightActivityId, resolveSessionPlanProfile } from "./workload.js";

export type HabitPlanInput = {
  id: string;
  name: string;
  icon: string | null;
  unit: HabitUnit;
  current_goal: number;
  checkin_value: number;
  template_id?: string | null;
  category_key?: string | null;
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

type SessionTier = "micro" | "language" | "books" | "flexible";

type HabitPlanEntry = {
  habit: HabitPlanInput;
  neededMin: number;
  tier: SessionTier;
  preferredMin: number;
  minMin: number;
  maxMin: number;
};

export function goalToMinutes(unit: HabitUnit, goal: number): number {
  switch (unit) {
    case "pages":
      return goal / BOOKS_PAGES_PER_MIN;
    case "minutes":
      return goal;
    case "reps":
      return (goal * PUSHUP_SECONDS_PER_REP) / 60;
    case "seconds":
      return goal / 60;
    case "lessons":
      return goal * LESSON_MINUTES_ESTIMATE;
    default:
      return goal;
  }
}

export function minutesToExpectedYield(unit: HabitUnit, minutes: number): number {
  switch (unit) {
    case "pages":
      return Math.round(BOOKS_PAGES_PER_MIN * minutes);
    case "minutes":
      return Math.round(minutes);
    case "reps":
      return Math.round((minutes * 60) / PUSHUP_SECONDS_PER_REP);
    case "seconds":
      return Math.round(minutes * 60);
    case "lessons":
      return Math.round(minutes / LESSON_MINUTES_ESTIMATE);
    default:
      return Math.round(minutes);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Includes remaining goal so completed block ids do not mark regenerated blocks after partial progress. */
function blockId(date: string, habitId: string, remainingGoal: number, index: number): string {
  return `${date}:${habitId}:${remainingGoal}:${index}`;
}

function resolveHabitPlanEntry(habit: HabitPlanInput, neededMin: number): HabitPlanEntry {
  const profile = resolveSessionPlanProfile(
    {
      name: habit.name,
      unit: habit.unit,
      templateId: (habit.template_id as HabitTemplateId | null) ?? null,
      categoryKey: (habit.category_key as import("@mytodo/shared").HabitCategoryKey | null) ?? null,
    },
    neededMin,
  );

  return {
    habit,
    neededMin: Math.max(neededMin, profile.preferredMin),
    tier: profile.tier,
    preferredMin: profile.preferredMin,
    minMin: profile.minMin,
    maxMin: profile.maxMin,
  };
}

function allocateBlockMinutes(entries: HabitPlanEntry[], budgetMin: number): Map<string, number> {
  const allocations = new Map<string, number>();
  let remaining = budgetMin;

  const microEntries = entries.filter((entry) => entry.tier === "micro");
  for (const entry of microEntries) {
    const allocated = clamp(
      entry.preferredMin,
      entry.minMin,
      Math.min(entry.maxMin, entry.neededMin, remaining),
    );
    allocations.set(entry.habit.id, allocated);
    remaining -= allocated;
  }

  const languageEntries = entries.filter((entry) => entry.tier === "language");
  for (const entry of languageEntries) {
    const allocated =
      remaining >= entry.minMin ? Math.min(entry.preferredMin, remaining) : 0;
    allocations.set(entry.habit.id, allocated);
    remaining -= allocated;
  }

  const booksEntries = entries.filter((entry) => entry.tier === "books");
  for (const entry of booksEntries) {
    const allocated = clamp(
      entry.preferredMin,
      entry.minMin,
      Math.min(entry.maxMin, remaining),
    );
    allocations.set(entry.habit.id, allocated);
    remaining -= allocated;
  }

  const flexibleEntries = entries.filter((entry) => entry.tier === "flexible");
  if (flexibleEntries.length === 0) {
    return allocations;
  }

  const flexibleNeeded = flexibleEntries.reduce((sum, entry) => sum + entry.neededMin, 0);
  if (flexibleNeeded <= 0) {
    for (const entry of flexibleEntries) {
      allocations.set(entry.habit.id, 0);
    }
    return allocations;
  }

  let flexibleRemaining = remaining;
  const provisional = flexibleEntries.map((entry) => {
    const rawShare = (remaining * entry.neededMin) / flexibleNeeded;
    const allocated = Math.min(
      entry.neededMin,
      Math.max(entry.minMin, Math.round(rawShare)),
    );
    flexibleRemaining -= allocated;
    return { entry, allocated };
  });

  while (flexibleRemaining > 0) {
    const candidate = provisional
      .filter(({ entry, allocated }) => allocated < entry.neededMin)
      .sort((left, right) => right.entry.neededMin - left.entry.neededMin)[0];
    if (!candidate) break;
    candidate.allocated += 1;
    flexibleRemaining -= 1;
  }

  while (flexibleRemaining < 0) {
    const candidate = provisional
      .filter(({ entry, allocated }) => allocated > entry.minMin)
      .sort((left, right) => left.allocated - right.allocated)[0];
    if (!candidate) break;
    candidate.allocated -= 1;
    flexibleRemaining += 1;
  }

  for (const { entry, allocated } of provisional) {
    allocations.set(entry.habit.id, allocated);
  }

  return allocations;
}

type HabitBlockDraft = Omit<DailyPlanBlock, "order" | "status" | "actual_value" | "actual_minutes">;

export function buildDailyPlan(input: {
  date: string;
  budgetMin: number;
  habits: HabitPlanInput[];
  completedBlockIds?: Set<string>;
  activeBlockId?: string | null;
  completedBlockMeta?: Map<string, { actual_value: number | null; actual_minutes: number | null }>;
}): DailyPlan {
  const {
    date,
    budgetMin,
    habits: inputHabits,
    completedBlockIds = new Set(),
    activeBlockId = null,
    completedBlockMeta = new Map(),
  } = input;

  const habits = sortLightHabitsForDisplay(inputHabits);

  const entries: HabitPlanEntry[] = [];

  for (const habit of habits) {
    const activityId = resolveLightActivityId({
      name: habit.name,
      unit: habit.unit,
      templateId: (habit.template_id as HabitTemplateId | null) ?? null,
      categoryKey: (habit.category_key as import("@mytodo/shared").HabitCategoryKey | null) ?? null,
    });
    if (isEarlyRiseActivity(activityId)) continue;

    const remainingGoal = Math.max(0, habit.current_goal - habit.checkin_value);
    if (remainingGoal <= 0) continue;

    const neededMin = goalToMinutes(habit.unit, remainingGoal);
    entries.push(resolveHabitPlanEntry(habit, neededMin));
  }

  if (entries.length === 0) {
    return {
      blocks: [],
      minutes_planned: 0,
      minutes_completed: 0,
      minutes_remaining: Math.max(0, budgetMin),
    };
  }

  const allocations = allocateBlockMinutes(entries, budgetMin);
  const drafts: HabitBlockDraft[] = [];

  for (const entry of entries) {
    const remainingGoal = Math.max(0, entry.habit.current_goal - entry.habit.checkin_value);
    const allocated = allocations.get(entry.habit.id) ?? 0;
    if (allocated <= 0) continue;

    if (entry.habit.unit === "seconds") {
      const durationSeconds = Math.max(1, Math.round(remainingGoal));
      drafts.push({
        id: blockId(date, entry.habit.id, remainingGoal, 0),
        habit_id: entry.habit.id,
        habit_name: entry.habit.name,
        icon: entry.habit.icon,
        unit: entry.habit.unit,
        duration_min: sessionBudgetMinutes(durationSeconds),
        expected_yield: durationSeconds,
      });
      continue;
    }

    const durationMin = Math.max(1, Math.ceil(allocated));

    drafts.push({
      id: blockId(date, entry.habit.id, remainingGoal, 0),
      habit_id: entry.habit.id,
      habit_name: entry.habit.name,
      icon: entry.habit.icon,
      unit: entry.habit.unit,
      duration_min: durationMin,
      expected_yield: minutesToExpectedYield(entry.habit.unit, durationMin),
    });
  }

  const blocks: DailyPlanBlock[] = drafts.map((draft, order) => {
    const isCompleted = completedBlockIds.has(draft.id);
    const isActive = !isCompleted && activeBlockId === draft.id;
    const meta = completedBlockMeta.get(draft.id);

    return {
      ...draft,
      order,
      status: isCompleted ? "completed" : isActive ? "active" : "pending",
      actual_value: isCompleted ? (meta?.actual_value ?? null) : null,
      actual_minutes: isCompleted ? (meta?.actual_minutes ?? null) : null,
    };
  });

  const minutes_planned = blocks.reduce((sum, block) => sum + block.duration_min, 0);
  const minutes_completed = blocks
    .filter((block) => block.status === "completed")
    .reduce((sum, block) => sum + (block.actual_minutes ?? 0), 0);
  const minutes_remaining = Math.max(0, budgetMin - minutes_completed);

  return {
    blocks,
    minutes_planned,
    minutes_completed,
    minutes_remaining,
  };
}
