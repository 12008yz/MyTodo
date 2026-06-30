import { SideToggle } from "../../components/SideToggle/SideToggle";
import { TimeDistributionSection } from "../../features/charts/TimeDistributionSection";
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

      <section className="home__section" aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="home__section-title">
          Статистика привычек
        </h2>
        <TimeDistributionSection />
      </section>
    </>
  );
}
