import { useHabitSide, type HabitSide } from "../../features/shell/SideContext";
import { runWithPreservedHomeScroll } from "../../utils/preserveHomeScroll";

export function SideToggle() {
  const { side, setSide } = useHabitSide();

  const selectSide = (next: HabitSide) => {
    if (next === side) {
      return;
    }
    runWithPreservedHomeScroll(() => setSide(next));
  };

  return (
    <div className="home__side-toggle" role="tablist" aria-label="Сторона привычек" data-active={side}>
      <span className="home__side-indicator" aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={side === "light"}
        className={["home__side-btn", side === "light" ? "is-active" : ""].filter(Boolean).join(" ")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => selectSide("light")}
      >
        ☀️ Светлая
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={side === "dark"}
        className={["home__side-btn", side === "dark" ? "is-active" : ""].filter(Boolean).join(" ")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => selectSide("dark")}
      >
        🌑 Тёмная
      </button>
    </div>
  );
}
