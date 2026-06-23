import { useEffect, useState } from "react";
import { BottomNav } from "../../components/BottomNav/BottomNav";
import { AddHabitModal } from "../../components/AddHabitModal/AddHabitModal";
import { SideProvider, useHabitSide } from "../../features/shell/SideContext";
import { requestPushSubscription } from "../../lib/push";
import { AnimatedOutlet } from "./AnimatedOutlet";
import "../../pages/HomePage/HomePage.css";

function AppShellInner() {
  const { side } = useHabitSide();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    void requestPushSubscription();
  }, []);

  return (
    <div className="home" data-side={side}>
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

      <BottomNav onAddClick={() => setAddOpen(true)} />
      <AddHabitModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

export function AppShell() {
  return (
    <SideProvider>
      <AppShellInner />
    </SideProvider>
  );
}
