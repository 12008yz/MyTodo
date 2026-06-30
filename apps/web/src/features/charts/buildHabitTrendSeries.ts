import type { ProgressPeriod, StatsCalendarResponse, StatsSide } from "@mytodo/shared";
import {
  habitChartMetric,
  habitChartUnit,
  mergeHabitChartUnit,
  shouldIncludeHabit,
  type HabitChartUnit,
} from "./habitChartMetric";
import { PIE_CHART_COLORS } from "./pieChartTokens";

const SERIES_PALETTE = Object.values(PIE_CHART_COLORS);
const MAX_SERIES = 3;

export type TrendSeries = {
  id: string;
  label: string;
  color: string;
  dataKey: string;
  total: number;
};

export type TrendPoint = {
  date: string;
  label: string;
  [dataKey: string]: number | string;
};

export type HabitTrendResult = {
  series: TrendSeries[];
  points: TrendPoint[];
  total: number;
  unit: HabitChartUnit;
  chartTitle: string;
  emptyMessage: string;
};

type HabitAccumulator = {
  habitId: string;
  label: string;
  unit: HabitChartUnit;
  total: number;
  byDate: Map<string, number>;
};

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function listDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

export function formatTrendAxisLabel(date: string, period: ProgressPeriod): string {
  const value = new Date(`${date}T12:00:00`);

  if (period === "week") {
    return value.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
  }

  if (period === "month") {
    return String(value.getDate());
  }

  return value.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
}

export function buildHabitTrendSeries(
  calendars: StatsCalendarResponse[],
  side: StatsSide,
  startDate: string,
  endDate: string,
  period: ProgressPeriod,
): HabitTrendResult {
  const accumulators = new Map<string, HabitAccumulator>();

  for (const calendar of calendars) {
    for (const day of calendar.days) {
      if (day.date < startDate || day.date > endDate) {
        continue;
      }

      for (const habit of day.habits) {
        if (!shouldIncludeHabit(habit, side)) {
          continue;
        }

        const amount = habitChartMetric(habit, side);
        if (amount <= 0) {
          continue;
        }

        const existing = accumulators.get(habit.habit_id);
        if (existing) {
          existing.total += amount;
          existing.byDate.set(day.date, (existing.byDate.get(day.date) ?? 0) + amount);
          existing.unit = mergeHabitChartUnit(existing.unit, habitChartUnit(habit, side));
          continue;
        }

        accumulators.set(habit.habit_id, {
          habitId: habit.habit_id,
          label: habit.name,
          unit: habitChartUnit(habit, side),
          total: amount,
          byDate: new Map([[day.date, amount]]),
        });
      }
    }
  }

  const ranked = [...accumulators.values()].sort((left, right) => right.total - left.total);
  const topHabits = ranked.slice(0, MAX_SERIES);
  const series: TrendSeries[] = topHabits.map((habit, index) => ({
    id: habit.habitId,
    label: habit.label,
    color: SERIES_PALETTE[index % SERIES_PALETTE.length]!,
    dataKey: `series${index}`,
    total: Math.round(habit.total),
  }));

  const dates = listDatesInRange(startDate, endDate);
  const points: TrendPoint[] = dates.map((date) => {
    const point: TrendPoint = {
      date,
      label: formatTrendAxisLabel(date, period),
    };

    topHabits.forEach((habit, index) => {
      const raw = habit.byDate.get(date) ?? 0;
      point[`series${index}`] = Math.round(raw);
    });

    return point;
  });

  const total = Math.round(ranked.reduce((sum, habit) => sum + habit.total, 0));
  const units = new Set(ranked.map((habit) => habit.unit).filter(Boolean));
  const unit = units.size === 1 ? (ranked[0]?.unit ?? null) : null;

  return {
    series,
    points,
    total,
    unit,
    chartTitle: side === "light" ? "Динамика" : "Расход",
    emptyMessage:
      side === "light"
        ? "Пока нет записанного времени по привычкам за выбранный период"
        : "Пока нет данных по привычкам за выбранный период",
  };
}
