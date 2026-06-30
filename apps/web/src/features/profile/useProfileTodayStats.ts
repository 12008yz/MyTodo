import { useQuery } from "@tanstack/react-query";
import { usesAbstinenceStreakRules } from "@mytodo/domain";
import { isCompanionLightHabit } from "@mytodo/shared";
import { getTodayDark, getTodayLight } from "../../lib/api";

function isEffectivelyOnTrack(
  habit: {
    type: "target" | "limit" | "abstinence";
    phase: "reduction" | "abstinence";
    category_key: string | null;
    name: string;
    checkin: { status: string } | null | undefined;
  },
): boolean {
  if (isCompanionLightHabit({ category_key: habit.category_key, name: habit.name })) {
    return true;
  }

  if (habit.checkin?.status === "success") {
    return true;
  }

  if (habit.checkin?.status === "fail") {
    return false;
  }

  return usesAbstinenceStreakRules(habit.type, habit.phase);
}

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

  const pending = allHabits.filter((habit) => !isEffectivelyOnTrack(habit)).length;

  const completed =
    (lightQuery.data?.stats?.completed_today ?? 0) + (darkQuery.data?.stats?.completed_today ?? 0);

  const isLoading = lightQuery.isLoading || darkQuery.isLoading;

  return { pending, completed, isLoading };
}
