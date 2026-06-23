import { SideToggle } from "../../components/SideToggle/SideToggle";
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
          Аналитика
        </h2>
        <p className="home__placeholder">
          Здесь появятся дополнительные графики — сводки по времени, помодоро, английскому и другим
          метрикам.
        </p>
      </section>
    </>
  );
}
