import {
  resolveStrengthProgressionLevel,
  strengthDailyGoalMinutes,
} from "@mytodo/shared";

export type DayStatus = "success" | "fail" | "skipped";

export type HabitForProgression = {
  type: "target" | "limit" | "abstinence";
  side: "light" | "dark";
  currentGoal: number;
  growthStep: number;
  progressionDirection: "increase" | "decrease" | "abstain";
  /** Lower bound after decrease (e.g. social media min 15 min). Defaults to 0. */
  minGoal?: number;
  /** Successful days at current goal before decrease/increase applies. Defaults to 1. */
  progressionIntervalDays?: number;
  /** Consecutive successful days counted toward the next goal change. */
  successDaysAtGoal?: number;
  /** Custom light habits — drives strength-workout rep progression when set. */
  categoryKey?: string | null;
  /** Strength workout by legacy name when category_key is missing. */
  name?: string | null;
  /** Strength workout stores progression level here (legacy: 4 = level 0). */
  baselineValue?: number;
};

export type ProgressionResult = {
  nextGoal: number;
  nextSuccessDaysAtGoal: number;
  nextBaselineValue?: number;
};

function isStrengthWorkoutProgression(habit: HabitForProgression): boolean {
  return (
    habit.categoryKey === "strength_workout" ||
    habit.name?.trim() === "Силовая тренировка"
  );
}

export function applyDayProgression(
  habit: HabitForProgression,
  dayStatus: DayStatus,
): ProgressionResult {
  const interval = habit.progressionIntervalDays ?? 1;
  const successDays = habit.successDaysAtGoal ?? 0;

  if (dayStatus === "fail") {
    return { nextGoal: habit.currentGoal, nextSuccessDaysAtGoal: 0 };
  }

  if (dayStatus !== "success") {
    return { nextGoal: habit.currentGoal, nextSuccessDaysAtGoal: successDays };
  }

  if (habit.type === "abstinence" || habit.progressionDirection === "abstain") {
    return { nextGoal: habit.currentGoal, nextSuccessDaysAtGoal: successDays };
  }

  const isIncrease = habit.type === "target" || habit.progressionDirection === "increase";
  const isDecrease = habit.type === "limit" || habit.progressionDirection === "decrease";

  if (isIncrease || isDecrease) {
    const nextSuccessDays = successDays + 1;
    if (nextSuccessDays >= interval) {
      if (isIncrease && isStrengthWorkoutProgression(habit)) {
        const level = resolveStrengthProgressionLevel(
          habit.baselineValue ?? 0,
          habit.currentGoal,
        );
        const nextLevel = level + 1;
        return {
          nextGoal: strengthDailyGoalMinutes(nextLevel),
          nextSuccessDaysAtGoal: 0,
          nextBaselineValue: nextLevel,
        };
      }

      if (isIncrease) {
        return {
          nextGoal: habit.currentGoal + habit.growthStep,
          nextSuccessDaysAtGoal: 0,
        };
      }

      const floor = habit.minGoal ?? 0;
      return {
        nextGoal: Math.max(floor, habit.currentGoal - habit.growthStep),
        nextSuccessDaysAtGoal: 0,
      };
    }

    return {
      nextGoal: habit.currentGoal,
      nextSuccessDaysAtGoal: nextSuccessDays,
    };
  }

  return { nextGoal: habit.currentGoal, nextSuccessDaysAtGoal: successDays };
}

export function computeNextGoal(habit: HabitForProgression, dayStatus: DayStatus): number {
  return applyDayProgression(habit, dayStatus).nextGoal;
}
