import type { QueryClient } from "@tanstack/react-query";
import { createCheckin } from "../../lib/api";
import { patchBooksHabitOnToday } from "./bookTodayCache";

const DEBOUNCE_MS = 400;

export type BooksCheckinSync = {
  schedule: (habitId: string, planDate: string, value: number) => void;
  acknowledgeServerValue: (value: number) => void;
  flush: () => Promise<void>;
  reset: () => void;
  dispose: () => void;
};

export function createBooksCheckinSync(queryClient: QueryClient): BooksCheckinSync {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: { habitId: string; planDate: string; value: number } | null = null;
  let inflight: Promise<void> | null = null;
  let lastAcknowledged = 0;

  const persist = async (): Promise<void> => {
    if (inflight) {
      await inflight;
    }

    const current = pending;
    if (!current || current.value <= lastAcknowledged) {
      pending = null;
      return;
    }

    const snapshot = current;
    pending = null;

    inflight = (async () => {
      try {
        const response = await createCheckin({
          habit_id: snapshot.habitId,
          date: snapshot.planDate,
          value: snapshot.value,
        });
        const savedValue = response.value ?? snapshot.value;
        lastAcknowledged = Math.max(lastAcknowledged, savedValue);
        patchBooksHabitOnToday(queryClient, snapshot.habitId, { checkinValue: savedValue });
        await queryClient.invalidateQueries({ queryKey: ["today", "light"] });
      } catch {
        pending = snapshot;
      }
    })();

    try {
      await inflight;
    } finally {
      inflight = null;
    }
  };

  const schedule = (habitId: string, planDate: string, value: number) => {
    if (value <= lastAcknowledged) {
      return;
    }

    const nextValue = Math.max(pending?.value ?? 0, value);
    pending = { habitId, planDate, value: nextValue };
    patchBooksHabitOnToday(queryClient, habitId, { checkinValue: nextValue });

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void persist();
    }, DEBOUNCE_MS);
  };

  const flush = async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    await persist();
  };

  return {
    schedule,
    acknowledgeServerValue: (value: number) => {
      lastAcknowledged = Math.max(lastAcknowledged, value);
    },
    flush,
    reset: () => {
      lastAcknowledged = 0;
      pending = null;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
    dispose: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (pending) {
        void persist();
      }
    },
  };
}
