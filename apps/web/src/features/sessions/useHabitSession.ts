import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useStartHabitSession(side: StatsSide) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ habitId, payload }: SessionMutationPayload<StartHabitSessionRequest>) =>
      startSession(habitId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["today", side] });
    },
  });
}

export function useCompleteHabitSession(side: StatsSide) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ habitId, payload }: SessionMutationPayload<CompleteHabitSessionRequest>) =>
      completeSession(habitId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["today", side] });
    },
  });
}

export function useStopHabitSession(side: StatsSide) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (habitId: string) => stopSession(habitId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["today", side] });
    },
  });
}
