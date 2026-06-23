import { NavLink } from "react-router-dom";

function AddIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M7 14H21" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 7V21" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type BottomNavProps = {
  onAddClick: () => void;
};

export function BottomNav({ onAddClick }: BottomNavProps) {
  return (
    <nav className="home__navbar" aria-label="Основная навигация">
      <div className="home__navbar-bg" aria-hidden="true">
        <svg
          className="home__navbar-bg-svg"
          viewBox="0 0 375 56"
          fill="none"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="home__navbar-bg-path"
            d="M0 22C0 9.84974 9.84974 0 22 0H93.5H141C141 0 145.5 0 154 0C164.148 0 162 27 187.5 27C214.5 27 210.735 -5.64924e-06 220.5 0C229 4.91738e-06 233.5 0 233.5 0H282.5H353C365.15 0 375 9.84974 375 22V56H0V22Z"
          />
        </svg>
      </div>

      <div className="home__navbar-items">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            ["home__nav-item", isActive ? "home__nav-item--active" : ""].filter(Boolean).join(" ")
          }
        >
          <img src="/navbar/home.svg" alt="" />
          <span className="home__nav-label">Сегодня</span>
        </NavLink>

        <NavLink
          to="/progress"
          className={({ isActive }) =>
            ["home__nav-item", isActive ? "home__nav-item--active" : ""].filter(Boolean).join(" ")
          }
        >
          <img src="/navbar/calendar.svg" alt="" />
          <span className="home__nav-label">Прогресс</span>
        </NavLink>

        <span className="home__nav-fab-spacer" aria-hidden="true" />

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            ["home__nav-item", isActive ? "home__nav-item--active" : ""].filter(Boolean).join(" ")
          }
        >
          <img src="/navbar/profile-2user.svg" alt="" />
          <span className="home__nav-label">Профиль</span>
        </NavLink>
      </div>

      <button type="button" className="home__nav-add" aria-label="Добавить привычку" onClick={onAddClick}>
        <AddIcon />
      </button>
    </nav>
  );
}
