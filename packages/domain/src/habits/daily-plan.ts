import {
  BOOKS_PAGES_PER_MIN,
  LESSON_MINUTES_ESTIMATE,
  PUSHUP_SECONDS_PER_REP,
  SESSION_MAX_MIN,
  SESSION_MIN_MIN,
  SESSION_TARGET_MIN,
  type HabitUnit,
} from "@mytodo/shared";

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
    habits,
    completedBlockIds = new Set(),
    activeBlockId = null,
    completedBlockMeta = new Map(),
  } = input;

  const habitBudgets: Array<{
    habit: HabitPlanInput;
    neededMin: number;
    habitBudgetMin: number;
  }> = [];

  let totalNeeded = 0;

  for (const habit of habits) {
    const remainingGoal = Math.max(0, habit.current_goal - habit.checkin_value);
    if (remainingGoal <= 0) continue;

    const neededMin = goalToMinutes(habit.unit, remainingGoal);
    totalNeeded += neededMin;
    habitBudgets.push({ habit, neededMin, habitBudgetMin: neededMin });
  }

  if (totalNeeded === 0) {
    return {
      blocks: [],
      minutes_planned: 0,
      minutes_completed: 0,
      minutes_remaining: Math.max(0, budgetMin),
    };
  }

  const scale = Math.min(1, budgetMin / totalNeeded);

  for (const entry of habitBudgets) {
    entry.habitBudgetMin = entry.neededMin * scale;
  }

  const blocksByHabit: HabitBlockDraft[][] = [];

  for (const { habit, habitBudgetMin } of habitBudgets) {
    const remainingGoal = Math.max(0, habit.current_goal - habit.checkin_value);
    const sessionCount = Math.max(1, Math.round(habitBudgetMin / SESSION_TARGET_MIN));
    const rawSessionMin = Math.round(habitBudgetMin / sessionCount);
    const sessionMin =
      scale < 1
        ? clamp(1, rawSessionMin, SESSION_MAX_MIN)
        : clamp(SESSION_MIN_MIN, rawSessionMin, SESSION_MAX_MIN);

    const habitBlocks: HabitBlockDraft[] = [];
    for (let index = 0; index < sessionCount; index++) {
      habitBlocks.push({
        id: blockId(date, habit.id, remainingGoal, index),
        habit_id: habit.id,
        habit_name: habit.name,
        icon: habit.icon,
        unit: habit.unit,
        duration_min: sessionMin,
        expected_yield: minutesToExpectedYield(habit.unit, sessionMin),
      });
    }
    blocksByHabit.push(habitBlocks);
  }

  const interleaved: HabitBlockDraft[] = [];
  const maxBlocks = Math.max(0, ...blocksByHabit.map((blocks) => blocks.length));

  for (let round = 0; round < maxBlocks; round++) {
    for (const habitBlocks of blocksByHabit) {
      const block = habitBlocks[round];
      if (block) {
        interleaved.push(block);
      }
    }
  }

  const blocks: DailyPlanBlock[] = interleaved.map((draft, order) => {
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
