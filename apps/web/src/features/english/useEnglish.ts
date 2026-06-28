import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeEnglishLesson,
  getEnglishHistory,
  getEnglishToday,
  skipEnglishLesson,
  updateEnglishSettings,
} from "../../lib/api";

export const englishQueryKeys = {
  today: ["english", "today"] as const,
  history: ["english", "history"] as const,
};

export function useEnglishToday() {
  return useQuery({
    queryKey: englishQueryKeys.today,
    queryFn: getEnglishToday,
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
      queryClient.invalidateQueries({ queryKey: englishQueryKeys.history }),
    ]);
  };

  const enable = useMutation({
    mutationFn: () => updateEnglishSettings({ is_enabled: true }),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: (watchedSec: number) => completeEnglishLesson({ watched_sec: watchedSec }),
    onSuccess: invalidate,
  });

  const skip = useMutation({
    mutationFn: skipEnglishLesson,
    onSuccess: invalidate,
  });

  return { enable, complete, skip };
}
