import type { ProgressPeriod, StatsCalendarResponse, StatsSide } from "@mytodo/shared";
import { listDatesInclusive } from "@mytodo/domain";
import {
  habitChartMetric,
  habitChartUnit,
  mergeHabitChartUnit,
  shouldIncludeHabit,
  type HabitChartUnit,
} from "./habitChartMetric";
import { chartSeriesColor } from "./pieChartTokens";

export type TrendSeries = {
  id: string;
  label: string;
  color: string;
  dataKey: string;
  total: number;
  unit: HabitChartUnit;
};

export type TrendPoint = {
  date: string;
  label: string;
  [dataKey: string]: number | string;
};

export type HabitTrendResult = {
  side: StatsSide;
  period: ProgressPeriod;
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

function spansMultipleMonths(startDate: string, endDate: string): boolean {
  return startDate.slice(0, 7) !== endDate.slice(0, 7);
}

export function formatTrendAxisLabel(
  date: string,
  period: ProgressPeriod,
  range?: { start: string; end: string },
): string {
  const value = new Date(`${date}T12:00:00.000Z`);

  if (period === "week") {
    return value.toLocaleDateString("ru-RU", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  }

  if (period === "month" && range && !spansMultipleMonths(range.start, range.end)) {
    return String(value.getUTCDate());
  }

  return value
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace(".", "");
}

export function formatTrendTooltipDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  return value.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function buildHabitTrendSeries(
  calendars: StatsCalendarResponse[],
  side: StatsSide,
  startDate: string,
  endDate: string,
  period: ProgressPeriod,
): HabitTrendResult {
  const accumulators = new Map<string, HabitAccumulator>();

  const ensureHabit = (habit: StatsCalendarResponse["days"][number]["habits"][number]) => {
    const existing = accumulators.get(habit.habit_id);
    if (existing) {
      existing.label = habit.name;
      existing.unit = mergeHabitChartUnit(existing.unit, habitChartUnit(habit, side));
      return existing;
    }

    const created: HabitAccumulator = {
      habitId: habit.habit_id,
      label: habit.name,
      unit: habitChartUnit(habit, side),
      total: 0,
      byDate: new Map(),
    };
    accumulators.set(habit.habit_id, created);
    return created;
  };

  for (const calendar of calendars) {
    for (const day of calendar.days) {
      if (day.date < startDate || day.date > endDate) {
        continue;
      }

      for (const habit of day.habits) {
        if (!shouldIncludeHabit(habit, side)) {
          continue;
        }

        const entry = ensureHabit(habit);
        const amount = habitChartMetric(habit, side);
        entry.total += amount;
        entry.byDate.set(day.date, (entry.byDate.get(day.date) ?? 0) + amount);
        entry.unit = mergeHabitChartUnit(entry.unit, habitChartUnit(habit, side));
      }
    }
  }

  const ranked = [...accumulators.values()].sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    return left.label.localeCompare(right.label, "ru");
  });

  const series: TrendSeries[] = ranked.map((habit, index) => ({
    id: habit.habitId,
    label: habit.label,
    color: chartSeriesColor(index),
    dataKey: `series${index}`,
    total: Math.round(habit.total),
    unit: habit.unit,
  }));

  const dates = listDatesInclusive(startDate, endDate);
  const range = { start: startDate, end: endDate };
  const points: TrendPoint[] = dates.map((date) => {
    const point: TrendPoint = {
      date,
      label: formatTrendAxisLabel(date, period, range),
    };

    ranked.forEach((habit, index) => {
      const raw = habit.byDate.get(date) ?? 0;
      point[`series${index}`] = Math.round(raw);
    });

    return point;
  });

  const total = Math.round(ranked.reduce((sum, habit) => sum + habit.total, 0));
  const units = new Set(ranked.map((habit) => habit.unit).filter(Boolean));
  const unit = units.size === 1 ? (ranked[0]?.unit ?? null) : null;

  return {
    side,
    period,
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
