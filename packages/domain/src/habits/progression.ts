export type DayStatus = "success" | "fail" | "skipped";

export type HabitForProgression = {
  type: "target" | "limit" | "abstinence";
  side: "light" | "dark";
  currentGoal: number;
  growthStep: number;
  progressionDirection: "increase" | "decrease" | "abstain";
  /** Lower bound after decrease (e.g. social media min 15 min). Defaults to 0. */
  minGoal?: number;
};

export function computeNextGoal(habit: HabitForProgression, dayStatus: DayStatus): number {
  if (dayStatus !== "success") {
    return habit.currentGoal;
  }

  if (habit.type === "target" || habit.progressionDirection === "increase") {
    return habit.currentGoal + habit.growthStep;
  }

  if (habit.type === "limit" || habit.progressionDirection === "decrease") {
    const floor = habit.minGoal ?? 0;
    return Math.max(floor, habit.currentGoal - habit.growthStep);
  }

  return habit.currentGoal;
}
