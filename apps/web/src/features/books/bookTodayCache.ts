import { resolveCheckinStatus } from "@mytodo/domain";
import type { TodayLightResponse } from "@mytodo/shared";
import type { QueryClient } from "@tanstack/react-query";

export function patchBooksHabitOnToday(
  queryClient: QueryClient,
  habitId: string,
  patch: {
    checkinValue?: number;
    lastReadPage?: number;
    readerDayStartPage?: number;
    readerDayDate?: string;
  },
): void {
  queryClient.setQueryData<TodayLightResponse>(["today", "light"], (old) => {
    if (!old) {
      return old;
    }

    return {
      ...old,
      habits: old.habits.map((habit) => {
        if (habit.id !== habitId || habit.template_id !== "books") {
          return habit;
        }

        let next = habit;

        if (patch.checkinValue != null) {
          const previousValue = Math.max(
            next.checkin?.value ?? 0,
            "reading" in next && next.reading ? next.reading.pages_credited_today : 0,
          );
          const nextValue = Math.max(patch.checkinValue, previousValue);
          const status = resolveCheckinStatus(
            {
              type: habit.type,
              side: habit.side,
              currentGoal: habit.current_goal,
              templateId: habit.template_id,
            },
            { value: nextValue },
          );
          const updatedAt = new Date().toISOString();
          next = {
            ...next,
            checkin: {
              id: next.checkin?.id ?? `optimistic-${habitId}`,
              date: next.checkin?.date ?? old.date,
              value: nextValue,
              status,
              updated_at: updatedAt,
              current_goal: habit.current_goal,
              preview_next_goal: habit.preview_next_goal,
            },
          };
        }

        if (
          (patch.lastReadPage != null ||
            patch.checkinValue != null ||
            patch.readerDayStartPage != null ||
            patch.readerDayDate != null) &&
          "reading" in next &&
          next.reading
        ) {
          next = {
            ...next,
            reading: {
              ...next.reading,
              ...(patch.lastReadPage != null ? { last_read_page: patch.lastReadPage } : {}),
              ...(patch.readerDayStartPage != null
                ? { reader_day_start_page: patch.readerDayStartPage }
                : {}),
              ...(patch.readerDayDate != null ? { reader_day_date: patch.readerDayDate } : {}),
              ...(patch.checkinValue != null && next.checkin?.value != null
                ? {
                    pages_credited_today: next.checkin.value,
                    last_checkin_date: old.date,
                  }
                : {}),
            },
          };
        }

        return next;
      }),
    };
  });
}
