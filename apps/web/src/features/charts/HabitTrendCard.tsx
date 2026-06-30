import { lazy, Suspense } from "react";
import type { HabitUnit } from "@mytodo/shared";
import { formatUnit } from "../today/format";
import type { TrendSeries, TrendPoint } from "./buildHabitTrendSeries";
import { useAnimatedNumber } from "./useAnimatedNumber";
import "./HabitTrendCard.css";

const HabitTrendChart = lazy(() =>
  import("./HabitTrendChart").then((module) => ({ default: module.HabitTrendChart })),
);

export type HabitTrendVariant = "light-side" | "dark-side";

type HabitTrendCardProps = {
  title: string;
  subtitle: string;
  points: TrendPoint[];
  series: TrendSeries[];
  variant: HabitTrendVariant;
  total: number;
  unit?: HabitUnit | "days" | null;
  animationKey: string;
  chartKey: string;
  isRefreshing?: boolean;
};

function formatCenterUnit(unit: HabitUnit | "days" | null | undefined): string | null {
  if (!unit) {
    return null;
  }
  if (unit === "days") {
    return "дн.";
  }
  return formatUnit(unit);
}

function formatLegendValue(value: number, unit: HabitUnit | "days" | null | undefined): string {
  const unitLabel = formatCenterUnit(unit);
  return unitLabel ? `${value} ${unitLabel}` : String(value);
}

function ChartLoadingFallback() {
  return (
    <div className="habit-trend-chart habit-trend-chart--loading" aria-hidden="true">
      <div className="habit-trend-chart__loading-shimmer" />
    </div>
  );
}

export function HabitTrendCard({
  title,
  subtitle,
  points,
  series,
  variant,
  total,
  unit,
  animationKey,
  chartKey,
  isRefreshing = false,
}: HabitTrendCardProps) {
  const animatedTotal = useAnimatedNumber(total, total > 0, 450, animationKey);
  const unitLabel = formatCenterUnit(unit);

  return (
    <article
      className={["habit-trend-card", `habit-trend-card--${variant}`].join(" ")}
      aria-label={title}
    >
      <header className="habit-trend-card__header">
        <div className="habit-trend-card__heading">
          <div className="habit-trend-card__title-row">
            <h3 className="habit-trend-card__title">{title}</h3>
            <div className="habit-trend-card__total" aria-live="polite">
              <span className="habit-trend-card__total-value">{animatedTotal}</span>
              {unitLabel ? (
                <span className="habit-trend-card__total-unit">{unitLabel}</span>
              ) : (
                <span className="habit-trend-card__total-unit habit-trend-card__total-unit--muted">
                  всего
                </span>
              )}
            </div>
          </div>
          <p className="habit-trend-card__subtitle">{subtitle}</p>
        </div>
      </header>

      <div
        className={[
          "habit-trend-card__chart-block",
          isRefreshing ? "habit-trend-card__chart-block--refreshing" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Suspense fallback={<ChartLoadingFallback />}>
          <HabitTrendChart
            points={points}
            series={series}
            variant={variant}
            chartKey={chartKey}
          />
        </Suspense>
      </div>

      <ul className="habit-trend-card__legend" aria-label="Легенда">
        {series.map((item) => (
          <li key={item.id} className="habit-trend-card__legend-item">
            <span
              className="habit-trend-card__legend-dot"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="habit-trend-card__legend-label">{item.label}</span>
            <span className="habit-trend-card__legend-meta">{formatLegendValue(item.total, unit)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
