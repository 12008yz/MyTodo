import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCheckinRequest,
  StatsSide,
  TodayDarkHabit,
  TodayDarkResponse,
  TodayLightHabit,
  TodayLightResponse,
} from "@mytodo/shared";
import { createCheckin, getStatsWeek, getTodayDark, getTodayLight } from "../../lib/api";

export type TodaySide = StatsSide;
export type TodayDashboard = TodayLightResponse | TodayDarkResponse;

export function useTodayDashboard(side: TodaySide) {
  const query = useQuery<TodayDashboard>({
    queryKey: ["today", side],
    queryFn: (): Promise<TodayDashboard> =>
      side === "light" ? getTodayLight() : getTodayDark(),
    placeholderData: keepPreviousData,
  });

  const weekQuery = useQuery({
    queryKey: ["stats-week", side],
    queryFn: () => getStatsWeek(side),
    placeholderData: keepPreviousData,
  });

  return {
    dashboard: query.data,
    week: weekQuery.data,
    isLoading: query.isLoading || weekQuery.isLoading,
    isError: query.isError || weekQuery.isError,
    error: query.error ?? weekQuery.error,
    refetch: async () => {
      await Promise.all([query.refetch(), weekQuery.refetch()]);
    },
  };
}

export function useCheckinMutation(side: TodaySide) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCheckinRequest) => createCheckin(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["today", side] });
      await queryClient.invalidateQueries({ queryKey: ["stats-week", side] });
    },
  });
}

export type TodayHabit = TodayLightHabit | TodayDarkHabit;
