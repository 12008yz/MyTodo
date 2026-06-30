import { SideToggle } from "../../components/SideToggle/SideToggle";
import { HabitProgressSection } from "../../features/progress/HabitProgressSection";
import { isDemoMode } from "../../lib/demo-mode";

export function ChartsPage() {
  return (
    <>
      <header className="home__page-header">
        <h1 className="home__page-title">Графики</h1>
      </header>

      {isDemoMode() ? (
        <p className="home__demo-banner" role="status">
          Демо-режим — данные считаются локально.
        </p>
      ) : null}

      <SideToggle />

      <section className="home__section" aria-labelledby="habit-chart-heading">
        <h2 id="habit-chart-heading" className="home__section-title">
          График привычки
        </h2>
        <HabitProgressSection />
      </section>

      <section className="home__section" aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="home__section-title">
          Аналитика
        </h2>
        <p className="home__placeholder">
          Скоро здесь появятся сводки по времени, помодоро, английскому и другим метрикам.
        </p>
      </section>
    </>
  );
}
