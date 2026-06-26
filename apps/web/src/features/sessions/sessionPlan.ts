import type { DailyPlanBlock, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import { SESSION_TARGET_MIN, sessionBudgetMinutes } from "@mytodo/shared";

export const EXTRA_SESSION_MIN_MIN = 5;
export const EXTRA_SESSION_MAX_MIN = 30;
export const EXTRA_SESSION_STEP_MIN = 1;
export const EXTRA_SESSION_MIN_SECONDS = 10;
export const EXTRA_SESSION_MAX_SECONDS = 300;
export const EXTRA_SESSION_STEP_SECONDS = 5;

export type SessionPlan = {
  plannedMin: number;
  plannedSeconds: number | null;
};

export type StartSessionOverrides = SessionPlan;

export function createFocusBlock(
  habit: TodayLightHabit | TodayDarkHabit,
  plannedMin: number,
  plannedSeconds: number | null = null,
): DailyPlanBlock {
  return {
    id: `bonus-${habit.id}`,
    habit_id: habit.id,
    habit_name: habit.name,
    icon: habit.icon ?? null,
    unit: habit.unit,
    duration_min: plannedMin,
    expected_yield: plannedSeconds ?? 0,
    order: 0,
    status: "pending",
    actual_value: null,
    actual_minutes: null,
  };
}

export function resolveSessionPlan(
  habit: TodayLightHabit | TodayDarkHabit,
  block: DailyPlanBlock | null,
  fallbackMin = SESSION_TARGET_MIN,
): SessionPlan {
  if (block?.unit === "seconds" && block.expected_yield > 0) {
    const plannedSeconds = Math.max(1, Math.round(block.expected_yield));
    return {
      plannedSeconds,
      plannedMin: sessionBudgetMinutes(plannedSeconds),
    };
  }

  if (habit.unit === "seconds") {
    const remaining = Math.max(0, habit.current_goal - (habit.checkin?.value ?? 0));
    const plannedSeconds = Math.max(1, Math.round(remaining > 0 ? remaining : habit.current_goal));
    return {
      plannedSeconds,
      plannedMin: sessionBudgetMinutes(plannedSeconds),
    };
  }

  return {
    plannedMin: block?.duration_min ?? fallbackMin,
    plannedSeconds: null,
  };
}

export function clampExtraSessionMinutes(value: number): number {
  return Math.min(EXTRA_SESSION_MAX_MIN, Math.max(EXTRA_SESSION_MIN_MIN, Math.round(value)));
}

export function clampExtraSessionSeconds(value: number, goal = 0): number {
  const maxSeconds = goal > 0 ? Math.max(EXTRA_SESSION_MAX_SECONDS, goal) : EXTRA_SESSION_MAX_SECONDS;
  return Math.min(maxSeconds, Math.max(EXTRA_SESSION_MIN_SECONDS, Math.round(value)));
}

export function formatExtraSessionDuration(plan: SessionPlan, unit: TodayLightHabit["unit"]): string {
  if (unit === "seconds" && plan.plannedSeconds != null) {
    return `${plan.plannedSeconds} сек`;
  }
  return `${plan.plannedMin} мин`;
}

export function sessionPlanTotalSeconds(plan: SessionPlan): number {
  if (plan.plannedSeconds != null && plan.plannedSeconds > 0) {
    return plan.plannedSeconds;
  }
  return Math.max(1, Math.round(plan.plannedMin * 60));
}

export function formatSessionCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function adjustExtraSessionPlan(
  plan: SessionPlan,
  unit: TodayLightHabit["unit"],
  delta: -1 | 1,
  goal = 0,
): SessionPlan {
  if (unit === "seconds") {
    const currentSeconds = plan.plannedSeconds ?? plan.plannedMin * 60;
    const plannedSeconds = clampExtraSessionSeconds(
      currentSeconds + delta * EXTRA_SESSION_STEP_SECONDS,
      goal,
    );
    return {
      plannedSeconds,
      plannedMin: sessionBudgetMinutes(plannedSeconds),
    };
  }

  const plannedMin = clampExtraSessionMinutes(plan.plannedMin + delta * EXTRA_SESSION_STEP_MIN);
  return {
    plannedMin,
    plannedSeconds: null,
  };
}

export function canDecreaseExtraSession(plan: SessionPlan, unit: TodayLightHabit["unit"]): boolean {
  if (unit === "seconds") {
    const currentSeconds = plan.plannedSeconds ?? plan.plannedMin * 60;
    return currentSeconds > EXTRA_SESSION_MIN_SECONDS;
  }
  return plan.plannedMin > EXTRA_SESSION_MIN_MIN;
}

export function canIncreaseExtraSession(
  plan: SessionPlan,
  unit: TodayLightHabit["unit"],
  goal = 0,
): boolean {
  if (unit === "seconds") {
    const currentSeconds = plan.plannedSeconds ?? plan.plannedMin * 60;
    const maxSeconds = goal > 0 ? Math.max(EXTRA_SESSION_MAX_SECONDS, goal) : EXTRA_SESSION_MAX_SECONDS;
    return currentSeconds < maxSeconds;
  }
  return plan.plannedMin < EXTRA_SESSION_MAX_MIN;
}
