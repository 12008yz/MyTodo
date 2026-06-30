import type { HabitUnit } from "@mytodo/shared";
import { formatUnit } from "../today/format";
import type { TrendSeries } from "./buildHabitTrendSeries";
import { HabitTrendChart } from "./HabitTrendChart";
import type { TrendPoint } from "./buildHabitTrendSeries";
import { useAnimatedNumber } from "./useAnimatedNumber";
import "./HabitTrendCard.css";

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
        <HabitTrendChart
          points={points}
          series={series}
          variant={variant}
          chartKey={chartKey}
        />
      </div>
    </article>
  );
}
