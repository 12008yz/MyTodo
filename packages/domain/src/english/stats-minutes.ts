import { isForeignLanguageHabit } from "@mytodo/shared";

export function sumEnglishWatchSecondsToMinutes(watchedSeconds: number[]): number {
  return watchedSeconds.reduce(
    (total, watchedSec) => total + Math.ceil(Math.max(0, watchedSec) / 60),
    0,
  );
}

export function sumMinutesHabitValueForTodayStats(
  habit: { unit?: string | null; category_key?: string | null; name?: string | null },
  timerMinutes: number | null | undefined,
  englishWatchMinutesToday: number,
): number {
  if (habit.unit !== "minutes") {
    return 0;
  }

  const timer = Math.max(0, timerMinutes ?? 0);
  if (!isForeignLanguageHabit(habit)) {
    return timer;
  }

  return timer + Math.max(0, englishWatchMinutesToday);
}
