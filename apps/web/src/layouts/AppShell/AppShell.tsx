import { useEffect, useState } from "react";
import { BottomNav } from "../../components/BottomNav/BottomNav";
import { AddHabitModal } from "../../components/AddHabitModal/AddHabitModal";
import { SideProvider, useHabitSide } from "../../features/shell/SideContext";
import { FocusSessionProvider, useFocusSession } from "../../features/shell/FocusSessionContext";
import { requestPushSubscription } from "../../lib/push";
import { prefetchChartsTab } from "../../features/charts/prefetchChartsTab";
import { AnimatedOutlet } from "./AnimatedOutlet";
import "../../pages/HomePage/HomePage.css";

function AppShellInner() {
  const { side } = useHabitSide();
  const { isActive: isFocusSessionActive } = useFocusSession();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    void requestPushSubscription();
  }, []);

  useEffect(() => {
    const schedulePrefetch = () => prefetchChartsTab();

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(schedulePrefetch, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(schedulePrefetch, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="home" data-side={side} data-focus-active={isFocusSessionActive || undefined}>
      <div className="home__side-stage" aria-hidden="true">
        <div className="home__side-layer home__side-layer--light" />
        <div className="home__side-layer home__side-layer--dark" />
      </div>

      <div className="home__blobs home__blobs--light" aria-hidden="true">
        <span className="home__blob home__blob--green" />
        <span className="home__blob home__blob--purple-left" />
        <span className="home__blob home__blob--purple-right" />
        <span className="home__blob home__blob--yellow" />
        <span className="home__blob home__blob--blue" />
        <span className="home__blob home__blob--orange" />
      </div>

      <div className="home__blobs home__blobs--dark" aria-hidden="true">
        <span className="home__blob home__blob--dark-purple" />
        <span className="home__blob home__blob--dark-orange" />
        <span className="home__blob home__blob--dark-blue" />
        <span className="home__blob home__blob--dark-violet" />
      </div>

      <div className="home__scroll">
        <AnimatedOutlet />
      </div>

      {!isFocusSessionActive ? <BottomNav onAddClick={() => setAddOpen(true)} /> : null}
      <AddHabitModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

export function AppShell() {
  return (
    <SideProvider>
      <FocusSessionProvider>
        <AppShellInner />
      </FocusSessionProvider>
    </SideProvider>
  );
}
