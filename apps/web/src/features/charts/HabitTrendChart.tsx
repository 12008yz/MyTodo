import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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

  return (
    <div className="habit-trend-tooltip">
      <p className="habit-trend-tooltip__label">{label}</p>
      <ul className="habit-trend-tooltip__list">
        {payload.map((entry) => (
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

  return (
    <div className={["habit-trend-chart", isDark ? "habit-trend-chart--dark" : ""].filter(Boolean).join(" ")}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart key={chartKey} data={points} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.id} id={`trend-fill-${item.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={0.38} />
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
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: 11,
              paddingTop: 8,
              color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
            }}
          />
          {series.map((item) => (
            <Area
              key={item.id}
              type="monotone"
              name={item.label}
              dataKey={item.dataKey}
              stroke={item.color}
              fill={`url(#trend-fill-${item.dataKey})`}
              strokeWidth={2.5}
              dot={{
                r: 3.5,
                fill: item.color,
                stroke: isDark ? "#1f2029" : "#ffffff",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5.5,
                fill: item.color,
                stroke: isDark ? "#1f2029" : "#ffffff",
                strokeWidth: 2,
              }}
              animationDuration={650}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
