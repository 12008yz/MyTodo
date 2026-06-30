import type { StatsChartMode, StatsProgressResponse } from "@mytodo/shared";

type HabitProgressChartProps = {
  data: StatsProgressResponse | undefined;
  isLoading: boolean;
  isFetching?: boolean;
  error?: string | null;
};

function barHeight(
  point: StatsProgressResponse["points"][number],
  chartMode: StatsChartMode,
  maxValue: number,
): number {
  if (point.status === "skipped") {
    return 0;
  }

  if (chartMode === "abstinence") {
    if (point.status === "success") {
      return 40;
    }
    if (point.status === "fail") {
      return 40;
    }
    if (point.status === "pending") {
      return 10;
    }
    return 0;
  }

  if (point.value == null) {
    return 0;
  }

  return (point.value / maxValue) * 40;
}

function goalLineY(
  point: StatsProgressResponse["points"][number],
  chartMode: StatsChartMode,
  maxValue: number,
): number | null {
  if (chartMode === "abstinence" || point.goal == null) {
    return null;
  }

  return 44 - (point.goal / maxValue) * 40;
}

export function HabitProgressChart({
  data,
  isLoading,
  isFetching = false,
  error,
}: HabitProgressChartProps) {
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

  const chartMode = data.chart_mode;
  const side = data.side;
  const values = data.points
    .map((point) => point.value)
    .filter((value): value is number => value != null);
  const goals = data.points
    .map((point) => point.goal)
    .filter((goal): goal is number => goal != null);
  const maxValue = Math.max(...values, ...goals, 1);
  const accent = side === "light" ? "#22c55e" : "#ef4444";
  const goalColor = side === "light" ? "#5f33e1" : "#ff7d53";
  const barWidth = 100 / data.points.length;
  const valueLegend =
    chartMode === "limit"
      ? "Использовано"
      : chartMode === "abstinence"
        ? "День"
        : "Выполнено";
  const goalLegend = chartMode === "limit" ? "Лимит" : "Цель";

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
          const valueHeight = barHeight(point, chartMode, maxValue);
          const goalY = goalLineY(point, chartMode, maxValue);
          const x = index * barWidth + barWidth * 0.15;
          const width = barWidth * 0.7;
          const isFail = point.status === "fail";
          const isPending = point.status === "pending";
          const barFill =
            chartMode === "abstinence" && isFail
              ? "#ef4444"
              : chartMode === "abstinence" && isPending
                ? "#94a3b8"
                : accent;

          return (
            <g key={point.date}>
              {valueHeight > 0 ? (
                <rect
                  x={x}
                  y={44 - valueHeight}
                  width={width}
                  height={Math.max(valueHeight, 0.5)}
                  fill={barFill}
                  opacity={isFail ? 0.85 : isPending ? 0.55 : 0.85}
                  rx={0.4}
                />
              ) : null}
              {goalY != null ? (
                <line
                  x1={x}
                  x2={x + width}
                  y1={goalY}
                  y2={goalY}
                  stroke={goalColor}
                  strokeWidth={0.6}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="progress__chart-legend">
        <span className="progress__chart-legend-item">
          <span className="progress__chart-swatch progress__chart-swatch--value" data-side={side} />
          {valueLegend}
        </span>
        {chartMode !== "abstinence" ? (
          <span className="progress__chart-legend-item">
            <span className="progress__chart-swatch progress__chart-swatch--goal" data-side={side} />
            {goalLegend}
          </span>
        ) : null}
      </div>
    </div>
  );
}
