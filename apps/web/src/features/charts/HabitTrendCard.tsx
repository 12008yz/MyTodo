import type { HabitUnit, ProgressPeriod } from "@mytodo/shared";
import { formatUnit } from "../today/format";
import type { TrendSeries, TrendPoint } from "./buildHabitTrendSeries";
import { HabitTrendChart } from "./HabitTrendChart";
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
  period: ProgressPeriod;
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
  period,
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
            {unit !== null ? (
              <div className="habit-trend-card__total">
                <span className="habit-trend-card__total-value">{animatedTotal}</span>
                {unitLabel ? (
                  <span className="habit-trend-card__total-unit">{unitLabel}</span>
                ) : (
                  <span className="habit-trend-card__total-unit habit-trend-card__total-unit--muted">
                    всего
                  </span>
                )}
              </div>
            ) : null}
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
          chartKey={chartKey}
          period={period}
        />
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
            <span className="habit-trend-card__legend-meta">
              {formatLegendValue(item.total, unit ?? item.unit)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
