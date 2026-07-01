import { useState, type ReactNode } from "react";
import type { HabitUnit, ProgressPeriod } from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import { useHabitSide } from "../shell/SideContext";
import { formatUnit } from "../today/format";
import { useTodayDashboard } from "../today/useTodayData";
import { HabitTrendCard } from "./HabitTrendCard";
import { HabitTrendCardSkeleton } from "./HabitTrendCardSkeleton";
import { useTimeDistribution } from "./useTimeDistribution";
import "./pieChartDemo.css";

const PERIOD_OPTIONS: { value: ProgressPeriod; label: string }[] = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
];

const PERIOD_LABEL: Record<ProgressPeriod, string> = {
  week: "за неделю",
  month: "за месяц",
  quarter: "за квартал",
};

function formatUnitHint(unit: HabitUnit | "days" | null | undefined): string | null {
  if (unit === "days") {
    return "дни";
  }
  if (unit) {
    return formatUnit(unit);
  }
  return null;
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: ProgressPeriod;
  onChange: (period: ProgressPeriod) => void;
}) {
  return (
    <div
      className="progress__period-toggle pie-chart-panel__period"
      role="tablist"
      aria-label="Период диаграммы"
    >
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={period === option.value}
          className={[
            "progress__period-btn",
            period === option.value ? "progress__period-btn--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChartSkeleton({ variant }: { variant: "light-side" | "dark-side" }) {
  return <HabitTrendCardSkeleton variant={variant} />;
}

function buildSubtitle(
  side: "light" | "dark",
  period: ProgressPeriod,
  unit: HabitUnit | "days" | null | undefined,
): string {
  const sideLabel = side === "light" ? "светлая сторона" : "тёмная сторона";
  const unitHint = formatUnitHint(unit);
  const unitPart =
    unit === null
      ? ", смешанные единицы"
      : unitHint
        ? `, ${unitHint}`
        : "";
  return `${PERIOD_LABEL[period]}, ${sideLabel}${unitPart}`;
}

export function TimeDistributionSection() {
  const { side } = useHabitSide();
  const [period, setPeriod] = useState<ProgressPeriod>("week");
  const { dashboard, isLoading: isDashboardLoading } = useTodayDashboard(side);
  const today = dashboard?.date ?? null;
  const distributionQuery = useTimeDistribution(side, period, today);
  const data = distributionQuery.data;
  const variant = side === "light" ? "light-side" : "dark-side";
  const hasChartData = Boolean(data);
  const isChartLoading =
    (!today && isDashboardLoading) ||
    (Boolean(today) && distributionQuery.isPending && !hasChartData);
  const isChartRefreshing = distributionQuery.isFetching && hasChartData;

  const panel = (content: ReactNode) => (
    <div className="pie-chart-panel">
      <PeriodToggle period={period} onChange={setPeriod} />
      {content}
    </div>
  );

  if (!today && !isDashboardLoading) {
    return panel(
      <p className="home__placeholder home__placeholder--error">
        Не удалось определить дату пользователя
      </p>,
    );
  }

  if (isChartLoading) {
    return panel(<ChartSkeleton variant={variant} />);
  }

  if (distributionQuery.isError && !data) {
    const message =
      distributionQuery.error instanceof ClientApiError
        ? distributionQuery.error.message
        : "Не удалось загрузить распределение";

    return panel(<p className="home__placeholder home__placeholder--error">{message}</p>);
  }

  if (!data || data.series.length === 0) {
    return panel(
      <p className="home__placeholder">
        {data?.emptyMessage ??
          `Нет данных по привычкам на ${side === "light" ? "светлой" : "тёмной"} стороне`}
      </p>,
    );
  }

  return panel(
    <div className="charts-page__content">
      <HabitTrendCard
        title={data.chartTitle}
        subtitle={buildSubtitle(side, period, data.unit)}
        points={data.points}
        series={data.series}
        variant={variant}
        total={data.total}
        unit={data.unit}
        animationKey={`${side}-${period}`}
        chartKey={`${side}-${period}`}
        period={period}
        isRefreshing={isChartRefreshing}
      />
    </div>,
  );
}
