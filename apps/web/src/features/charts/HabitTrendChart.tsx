import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint, TrendSeries } from "./buildHabitTrendSeries";
import "./HabitTrendChart.css";

type HabitTrendChartProps = {
  points: TrendPoint[];
  series: TrendSeries[];
  variant: "light-side" | "dark-side";
  chartKey: string;
};

function chartHeight(seriesCount: number): number {
  return Math.min(320, Math.max(200, 180 + seriesCount * 4));
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

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entries = payload.filter((entry) => entry.value > 0);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="habit-trend-tooltip">
      <p className="habit-trend-tooltip__label">{label}</p>
      <ul className="habit-trend-tooltip__list">
        {entries.map((entry) => (
          <li key={entry.name} className="habit-trend-tooltip__item">
            <span className="habit-trend-tooltip__dot" style={{ backgroundColor: entry.color }} />
            <span className="habit-trend-tooltip__name">{entry.name}</span>
            <span className="habit-trend-tooltip__value">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HabitTrendChart({ points, series, variant, chartKey }: HabitTrendChartProps) {
  const isDark = variant === "dark-side";
  const fillOpacity = seriesFillOpacity(series.length);
  const showDots = series.length <= 6;
  const height = chartHeight(series.length);

  return (
    <div
      className={["habit-trend-chart", isDark ? "habit-trend-chart--dark" : ""].filter(Boolean).join(" ")}
      onMouseDown={(event) => event.preventDefault()}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart key={chartKey} data={points} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.id} id={`trend-fill-${item.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={fillOpacity} />
                <stop offset="95%" stopColor={item.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(95,51,225,0.12)"}
            vertical
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={{ fontSize: 10, fill: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip content={<TrendTooltip />} />
          {series.map((item) => (
            <Area
              key={item.id}
              type="monotone"
              name={item.label}
              dataKey={item.dataKey}
              stroke={item.color}
              fill={`url(#trend-fill-${item.dataKey})`}
              strokeWidth={series.length > 6 ? 2 : 2.5}
              dot={
                showDots
                  ? {
                      r: 3,
                      fill: item.color,
                      stroke: isDark ? "#1f2029" : "#ffffff",
                      strokeWidth: 2,
                    }
                  : false
              }
              activeDot={
                showDots
                  ? {
                      r: 5,
                      fill: item.color,
                      stroke: isDark ? "#1f2029" : "#ffffff",
                      strokeWidth: 2,
                    }
                  : { r: 4, fill: item.color }
              }
              animationDuration={650}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
