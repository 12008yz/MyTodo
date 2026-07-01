import { HabitTrendCardSkeleton } from "../../features/charts/HabitTrendCardSkeleton";
import { useHabitSide } from "../../features/shell/SideContext";
import "./ChartsPage.css";

export function ChartsPageSkeleton() {
  const { side } = useHabitSide();
  const variant = side === "light" ? "light-side" : "dark-side";

  return (
    <div className="charts-page charts-page--loading" aria-busy="true" aria-label="Загрузка графиков">
      <header className="home__page-header">
        <span className="charts-page__skeleton-title" aria-hidden="true" />
      </header>

      <span className="charts-page__skeleton-toggle" aria-hidden="true" />

      <section className="home__section" aria-hidden="true">
        <span className="charts-page__skeleton-section-title" />
        <div className="pie-chart-panel">
          <span className="charts-page__skeleton-period" />
          <HabitTrendCardSkeleton variant={variant} />
        </div>
      </section>
    </div>
  );
}
