import { useEffect, useRef, useState } from "react";
import { booksSessionMinutesForPages } from "@mytodo/domain";
import type { HabitReadingProgress, TodayLightHabit } from "@mytodo/shared";
import { formatSessionCountdown } from "../sessions/sessionPlan";

export function booksReadingGoalRemainingPages(habit: TodayLightHabit): number {
  const loggedToday = habit.checkin?.value ?? 0;
  return Math.max(0, habit.current_goal - loggedToday);
}

export function booksReadingBudgetSeconds(pagesRemaining: number): number {
  if (pagesRemaining <= 0) {
    return 0;
  }
  return booksSessionMinutesForPages(pagesRemaining) * 60;
}

export function resolveReadingTimerSeconds(
  reading: HabitReadingProgress | null | undefined,
  pagesRemaining: number,
  planDate: string,
): number {
  if (pagesRemaining <= 0) {
    return 0;
  }

  const budget = booksReadingBudgetSeconds(pagesRemaining);
  if (!reading || reading.timer_saved_date !== planDate) {
    return budget;
  }

  if (reading.timer_remaining_seconds == null) {
    return budget;
  }

  return Math.min(reading.timer_remaining_seconds, budget);
}

export function formatBooksReadingTimerLabel(pagesRemaining: number): string {
  if (pagesRemaining <= 0) {
    return "выполнена";
  }

  return `≈${pagesRemaining} стр.`;
}

export function useSyncedReadingTimer(options: {
  reading: HabitReadingProgress | null | undefined;
  planDate: string;
  pagesRemaining: number;
  sessionKey: string;
  enabled: boolean;
  onPersist: (seconds: number) => void;
}): number {
  const { reading, planDate, pagesRemaining, sessionKey, enabled, onPersist } = options;
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const bootstrappedKeyRef = useRef<string | null>(null);
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;

  useEffect(() => {
    if (!reading || !planDate) {
      return;
    }

    if (bootstrappedKeyRef.current === sessionKey) {
      return;
    }

    bootstrappedKeyRef.current = sessionKey;
    setRemainingSeconds(resolveReadingTimerSeconds(reading, pagesRemaining, planDate));
  }, [sessionKey, reading, planDate, pagesRemaining]);

  useEffect(() => {
    if (!enabled || remainingSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [enabled, remainingSeconds]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      onPersistRef.current(remainingSeconds);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [enabled, remainingSeconds]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return () => {
      onPersistRef.current(remainingSeconds);
    };
  }, [enabled, remainingSeconds]);

  return remainingSeconds;
}

export { formatSessionCountdown };
