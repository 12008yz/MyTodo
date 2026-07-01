import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getProgressPeriodRange } from "@mytodo/domain";
import type { ProgressPeriod, StatsSide } from "@mytodo/shared";
import { getStatsCalendar } from "../../lib/api";
import { buildHabitTrendSeries } from "./buildHabitTrendSeries";
import { listMonthsInRange } from "./listMonthsInRange";

export function useTimeDistribution(
  side: StatsSide,
  period: ProgressPeriod,
  today: string | null,
) {
  const range = today ? getProgressPeriodRange(today, period) : null;
  const months = range ? listMonthsInRange(range.start, range.end) : [];

  return useQuery({
    queryKey: ["time-distribution", side, period, range?.start, range?.end],
    queryFn: async () => {
      if (!range) {
        throw new Error("Дата пользователя недоступна");
      }

      const calendars = await Promise.all(months.map((month) => getStatsCalendar(month, side)));
      return buildHabitTrendSeries(calendars, side, range.start, range.end, period);
    },
    enabled: Boolean(range && months.length > 0),
    placeholderData: keepPreviousData,
  });
}
