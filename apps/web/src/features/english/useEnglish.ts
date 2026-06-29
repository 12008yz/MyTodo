import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeEnglishLesson,
  getEnglishCatalog,
  getEnglishHistory,
  getEnglishToday,
  recordEnglishWatch,
  selectEnglishLesson,
  skipEnglishLesson,
  updateEnglishSettings,
} from "../../lib/api";

export const englishQueryKeys = {
  today: ["english", "today"] as const,
  catalog: ["english", "catalog"] as const,
  history: ["english", "history"] as const,
};

export function useEnglishToday() {
  return useQuery({
    queryKey: englishQueryKeys.today,
    queryFn: getEnglishToday,
  });
}

export function useEnglishCatalog(enabled = true) {
  return useQuery({
    queryKey: englishQueryKeys.catalog,
    queryFn: getEnglishCatalog,
    enabled,
  });
}

export function useEnglishHistory(enabled: boolean) {
  return useQuery({
    queryKey: englishQueryKeys.history,
    queryFn: getEnglishHistory,
    enabled,
  });
}

export function useEnglishMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: englishQueryKeys.today }),
      queryClient.invalidateQueries({ queryKey: englishQueryKeys.catalog }),
      queryClient.invalidateQueries({ queryKey: englishQueryKeys.history }),
    ]);
  };

  const enable = useMutation({
    mutationFn: () => updateEnglishSettings({ is_enabled: true }),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: (watchedSec: number) => completeEnglishLesson({ watched_sec: watchedSec }),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["today"] });
    },
  });

  const skip = useMutation({
    mutationFn: skipEnglishLesson,
    onSuccess: invalidate,
  });

  const watch = useMutation({
    mutationFn: (watchedSec: number) => recordEnglishWatch({ watched_sec: watchedSec }),
    onSuccess: async (result) => {
      queryClient.setQueryData(englishQueryKeys.today, (current: Awaited<ReturnType<typeof getEnglishToday>> | undefined) => {
        if (!current || !current.enabled) {
          return current;
        }
        if (current.lesson.id !== result.lesson_id) {
          return current;
        }
        return {
          ...current,
          watched_sec: Math.max(current.watched_sec, result.watched_sec),
        };
      });
    },
  });

  const selectLesson = useMutation({
    mutationFn: (lessonId: string) => selectEnglishLesson({ lesson_id: lessonId }),
    onSuccess: async (result) => {
      queryClient.setQueryData(
        englishQueryKeys.today,
        (current: Awaited<ReturnType<typeof getEnglishToday>> | undefined) => {
          if (!current?.enabled) {
            return {
              enabled: true as const,
              current_day: result.current_day,
              lesson: result.lesson,
              selected_lesson_id: result.selected_lesson_id,
              day_status: result.day_status,
              watched_sec: result.watched_sec,
              preview_next_day: result.preview_next_day,
            };
          }
          return {
            ...current,
            current_day: result.current_day,
            lesson: result.lesson,
            selected_lesson_id: result.selected_lesson_id,
            day_status: result.day_status,
            watched_sec: result.watched_sec,
            preview_next_day: result.preview_next_day,
          };
        },
      );
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["today"] });
    },
  });

  return { enable, complete, skip, watch, selectLesson };
}
