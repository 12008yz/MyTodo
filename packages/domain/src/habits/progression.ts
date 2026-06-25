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
};

export type ProgressionResult = {
  nextGoal: number;
  nextSuccessDaysAtGoal: number;
};

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

  if (habit.type === "target" || habit.progressionDirection === "increase") {
    return {
      nextGoal: habit.currentGoal + habit.growthStep,
      nextSuccessDaysAtGoal: 0,
    };
  }

  if (habit.type === "limit" || habit.progressionDirection === "decrease") {
    const nextSuccessDays = successDays + 1;
    if (nextSuccessDays >= interval) {
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
