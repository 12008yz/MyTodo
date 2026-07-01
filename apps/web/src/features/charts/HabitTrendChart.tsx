import type { ProgressPeriod } from "@mytodo/shared";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTrendTooltipDate, type TrendPoint, type TrendSeries } from "./buildHabitTrendSeries";
import { formatUnit } from "../today/format";
import "./HabitTrendChart.css";

type HabitTrendChartProps = {
  points: TrendPoint[];
  series: TrendSeries[];
  chartKey: string;
  period: ProgressPeriod;
};

function chartHeight(seriesCount: number, pointCount: number): number {
  const base = Math.min(360, Math.max(220, 200 + seriesCount * 4));
  if (pointCount > 45) {
    return base + 24;
  }
  return base;
}

function seriesFillOpacity(seriesCount: number): number {
  if (seriesCount <= 3) {
    return 0.38;
  }
  if (seriesCount <= 6) {
    return 0.24;
  }
  return 0.16;
}

function xAxisTickInterval(period: ProgressPeriod, pointCount: number): number | "preserveStartEnd" {
  if (period === "week") {
    return 0;
  }

  if (period === "month") {
    return Math.max(1, Math.floor(pointCount / 6));
  }

  return Math.max(1, Math.floor(pointCount / 8));
}

function formatTooltipUnit(unit: TrendSeries["unit"]): string {
  if (unit === "days") {
    return "дн.";
  }
  if (unit) {
    return formatUnit(unit);
  }
  return "";
}

function TrendTooltip({
  active,
  payload,
  series,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TrendPoint }>;
  series: TrendSeries[];
}) {
  if (!active || !payload?.length || !series.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point || typeof point.date !== "string") {
    return null;
  }

  const entries = series
    .map((item) => ({
      color: item.color,
      name: item.label,
      value: Number(point[item.dataKey] ?? 0),
      unit: formatTooltipUnit(item.unit),
    }))
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, "ru"));

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="habit-trend-tooltip">
      <p className="habit-trend-tooltip__label">{formatTrendTooltipDate(point.date)}</p>
      <ul className="habit-trend-tooltip__list">
        {entries.map((entry) => (
          <li key={entry.name} className="habit-trend-tooltip__item">
            <span className="habit-trend-tooltip__dot" style={{ backgroundColor: entry.color }} />
            <span className="habit-trend-tooltip__name">{entry.name}</span>
            <span className="habit-trend-tooltip__value">
              {entry.value}
              {entry.unit ? ` ${entry.unit}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function seriesFillId(chartKey: string, seriesId: string): string {
  return `${chartKey}-fill-${seriesId}`;
}

export function HabitTrendChart({
  points,
  series,
  chartKey,
  period,
}: HabitTrendChartProps) {
  const fillOpacity = seriesFillOpacity(series.length);
  const showDots = series.length <= 6;
  const height = chartHeight(series.length, points.length);
  const tickInterval = xAxisTickInterval(period, points.length);

  return (
    <div className="habit-trend-chart" onMouseDown={(event) => event.preventDefault()}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart key={chartKey} data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.id} id={seriesFillId(chartKey, item.id)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={fillOpacity} />
                <stop offset="95%" stopColor={item.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="var(--ht-chart-grid)"
            vertical={period === "week"}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--ht-chart-tick)" }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            minTickGap={8}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--ht-chart-tick)" }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
            domain={[0, "auto"]}
          />
          <Tooltip content={<TrendTooltip series={series} />} />
          {series.map((item) => (
            <Area
              key={item.id}
              type="monotone"
              name={item.label}
              dataKey={item.dataKey}
              stroke={item.color}
              fill={`url(#${seriesFillId(chartKey, item.id)})`}
              strokeWidth={series.length > 6 ? 2 : 2.5}
              dot={
                showDots
                  ? {
                      r: 3,
                      fill: item.color,
                      stroke: "var(--ht-chart-dot-stroke)",
                      strokeWidth: 2,
                    }
                  : false
              }
              activeDot={
                showDots
                  ? {
                      r: 5,
                      fill: item.color,
                      stroke: "var(--ht-chart-dot-stroke)",
                      strokeWidth: 2,
                    }
                  : { r: 4, fill: item.color }
              }
              animationDuration={650}
              animationEasing="ease-out"
              isAnimationActive
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
