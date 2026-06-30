import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  CompleteHabitSessionRequest,
  StartHabitSessionRequest,
  StatsSide,
} from "@mytodo/shared";
import {
  completeSession,
  getActiveSession,
  startSession,
  stopSession,
} from "./session-api";

type SessionMutationPayload<TPayload> = {
  habitId: string;
  payload: TPayload;
};

export function useActiveHabitSession(habitId: string | null) {
  return useQuery({
    queryKey: ["habit-session-active", habitId],
    queryFn: () => getActiveSession(habitId!),
    enabled: Boolean(habitId),
  });
}

async function invalidateHabitStats(queryClient: QueryClient, side: StatsSide) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["today", side] }),
    queryClient.invalidateQueries({ queryKey: ["stats-week", side] }),
    queryClient.invalidateQueries({ queryKey: ["stats-calendar"] }),
    queryClient.invalidateQueries({ queryKey: ["stats-month"] }),
    queryClient.invalidateQueries({ queryKey: ["stats-progress"] }),
    queryClient.invalidateQueries({ queryKey: ["time-distribution"] }),
  ]);
}

export function useStartHabitSession(side: StatsSide) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ habitId, payload }: SessionMutationPayload<StartHabitSessionRequest>) =>
      startSession(habitId, payload),
    onSuccess: async () => {
      await invalidateHabitStats(queryClient, side);
    },
  });
}

export function useCompleteHabitSession(side: StatsSide) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ habitId, payload }: SessionMutationPayload<CompleteHabitSessionRequest>) =>
      completeSession(habitId, payload),
    onSuccess: async () => {
      await invalidateHabitStats(queryClient, side);
    },
  });
}

export function useStopHabitSession(side: StatsSide) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (habitId: string) => stopSession(habitId),
    onSuccess: async () => {
      await invalidateHabitStats(queryClient, side);
    },
  });
}
