import { useQuery } from "@tanstack/react-query";
import { getTodayDark, getTodayLight } from "../../lib/api";

export function useProfileTodayStats() {
  const lightQuery = useQuery({
    queryKey: ["today", "light"],
    queryFn: getTodayLight,
  });

  const darkQuery = useQuery({
    queryKey: ["today", "dark"],
    queryFn: getTodayDark,
  });

  const lightHabits = lightQuery.data?.habits ?? [];
  const darkHabits = darkQuery.data?.habits ?? [];
  const allHabits = [...lightHabits, ...darkHabits];

  const pending = allHabits.filter(
    (habit) => !habit.checkin || habit.checkin.status === "pending",
  ).length;

  const completed =
    (lightQuery.data?.stats?.completed_today ?? 0) + (darkQuery.data?.stats?.completed_today ?? 0);

  const isLoading = lightQuery.isLoading || darkQuery.isLoading;

  return { pending, completed, isLoading };
}
