import { NavLink, useLocation } from "react-router-dom";
import { prefetchChartsTab } from "../../features/charts/prefetchChartsTab";
import { getNavTabIndex, useNavShadow } from "./useNavShadow";

const NAV_ITEMS = [
  { to: "/", end: true, icon: "/navbar/home.svg", label: "Сегодня" },
  { to: "/progress", end: false, icon: "/navbar/calendar.svg", label: "Прогресс" },
  { to: "/charts", end: false, icon: "/navbar/charts.svg", label: "Графики" },
  { to: "/profile", end: false, icon: "/navbar/profile-2user.svg", label: "Профиль" },
] as const;

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
  const location = useLocation();
  const activeIndex = getNavTabIndex(location.pathname);
  const { containerRef, itemRefs, shadowRef } = useNavShadow(activeIndex);

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

      <div ref={containerRef} className="home__navbar-items">
        <span ref={shadowRef} className="home__nav-shadow" aria-hidden="true" />

        <NavLink
          ref={(element) => {
            itemRefs.current[0] = element;
          }}
          to={NAV_ITEMS[0]!.to}
          end={NAV_ITEMS[0]!.end}
          className={({ isActive }) =>
            ["home__nav-item", isActive ? "home__nav-item--active" : ""].filter(Boolean).join(" ")
          }
        >
          <img src={NAV_ITEMS[0]!.icon} alt="" />
          <span className="home__nav-label">{NAV_ITEMS[0]!.label}</span>
        </NavLink>

        <NavLink
          ref={(element) => {
            itemRefs.current[1] = element;
          }}
          to={NAV_ITEMS[1]!.to}
          end={NAV_ITEMS[1]!.end}
          className={({ isActive }) =>
            ["home__nav-item", isActive ? "home__nav-item--active" : ""].filter(Boolean).join(" ")
          }
        >
          <img src={NAV_ITEMS[1]!.icon} alt="" />
          <span className="home__nav-label">{NAV_ITEMS[1]!.label}</span>
        </NavLink>

        <span className="home__nav-fab-spacer" aria-hidden="true" />

        <NavLink
          ref={(element) => {
            itemRefs.current[2] = element;
          }}
          to={NAV_ITEMS[2]!.to}
          end={NAV_ITEMS[2]!.end}
          onMouseEnter={prefetchChartsTab}
          onFocus={prefetchChartsTab}
          onTouchStart={prefetchChartsTab}
          className={({ isActive }) =>
            ["home__nav-item", isActive ? "home__nav-item--active" : ""].filter(Boolean).join(" ")
          }
        >
          <img src={NAV_ITEMS[2]!.icon} alt="" />
          <span className="home__nav-label">{NAV_ITEMS[2]!.label}</span>
        </NavLink>

        <NavLink
          ref={(element) => {
            itemRefs.current[3] = element;
          }}
          to={NAV_ITEMS[3]!.to}
          end={NAV_ITEMS[3]!.end}
          className={({ isActive }) =>
            ["home__nav-item", isActive ? "home__nav-item--active" : ""].filter(Boolean).join(" ")
          }
        >
          <img src={NAV_ITEMS[3]!.icon} alt="" />
          <span className="home__nav-label">{NAV_ITEMS[3]!.label}</span>
        </NavLink>
      </div>

      <button type="button" className="home__nav-add" aria-label="Добавить привычку" onClick={onAddClick}>
        <AddIcon />
      </button>
    </nav>
  );
}
