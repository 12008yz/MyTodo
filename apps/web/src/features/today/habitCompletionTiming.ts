export const HABIT_COMPLETION_CELEBRATION_MS = 920;
export const HABIT_COMPLETION_FLIGHT_MS = 620;

export function waitForHabitCompletion(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
