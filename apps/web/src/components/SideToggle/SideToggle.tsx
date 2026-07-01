import { useHabitSide } from "../../features/shell/SideContext";

export function SideToggle() {
  const { side, setSide } = useHabitSide();

  return (
    <div className="home__side-toggle" role="tablist" aria-label="Сторона привычек" data-active={side}>
      <span className="home__side-indicator" aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={side === "light"}
        className={["home__side-btn", side === "light" ? "is-active" : ""].filter(Boolean).join(" ")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setSide("light")}
      >
        ☀️ Светлая
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={side === "dark"}
        className={["home__side-btn", side === "dark" ? "is-active" : ""].filter(Boolean).join(" ")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setSide("dark")}
      >
        🌑 Тёмная
      </button>
    </div>
  );
}
