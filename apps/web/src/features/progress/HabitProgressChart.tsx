import type { StatsProgressResponse } from "@mytodo/shared";
import { useHabitSide } from "../shell/SideContext";

type HabitProgressChartProps = {
  data: StatsProgressResponse | undefined;
  isLoading: boolean;
  isFetching?: boolean;
  error?: string | null;
};

export function HabitProgressChart({
  data,
  isLoading,
  isFetching = false,
  error,
}: HabitProgressChartProps) {
  const { side } = useHabitSide();

  if (isLoading) {
    return (
      <div
        className="progress__chart progress__chart--skeleton"
        aria-busy="true"
        aria-label="Загрузка графика"
      />
    );
  }

  if (error && !data) {
    return <p className="home__placeholder home__placeholder--error">{error}</p>;
  }

  if (!data || data.points.length === 0) {
    return <p className="home__placeholder">Нет данных за выбранный период</p>;
  }

  const values = data.points.map((point) => point.value ?? 0);
  const goals = data.points.map((point) => point.goal ?? 0);
  const maxValue = Math.max(...values, ...goals, 1);
  const accent = side === "light" ? "#22c55e" : "#ef4444";
  const goalColor = side === "light" ? "#5f33e1" : "#ff7d53";
  const barWidth = 100 / data.points.length;

  return (
    <div
      className={[
        "progress__chart",
        isFetching ? "progress__chart--refreshing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="График выполнения"
      aria-busy={isFetching}
    >
      {error ? (
        <p className="progress__chart-error" role="status">
          {error}
        </p>
      ) : null}
      <svg className="progress__chart-svg" viewBox="0 0 100 48" preserveAspectRatio="none">
        {data.points.map((point, index) => {
          const valueHeight = ((point.value ?? 0) / maxValue) * 40;
          const goalY = 44 - ((point.goal ?? 0) / maxValue) * 40;
          const x = index * barWidth + barWidth * 0.15;
          const width = barWidth * 0.7;

          return (
            <g key={point.date}>
              <rect
                x={x}
                y={44 - valueHeight}
                width={width}
                height={Math.max(valueHeight, 0.5)}
                fill={accent}
                opacity={point.status === "fail" ? 0.45 : 0.85}
                rx={0.4}
              />
              <line
                x1={x}
                x2={x + width}
                y1={goalY}
                y2={goalY}
                stroke={goalColor}
                strokeWidth={0.6}
              />
            </g>
          );
        })}
      </svg>
      <div className="progress__chart-legend">
        <span className="progress__chart-legend-item">
          <span className="progress__chart-swatch progress__chart-swatch--value" data-side={side} />
          Выполнено
        </span>
        <span className="progress__chart-legend-item">
          <span className="progress__chart-swatch progress__chart-swatch--goal" data-side={side} />
          Цель
        </span>
      </div>
    </div>
  );
}
