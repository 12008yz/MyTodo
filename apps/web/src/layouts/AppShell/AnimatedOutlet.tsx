import { useLayoutEffect, useRef } from "react";
import { useLocation, useOutlet } from "react-router-dom";

const TAB_ORDER = ["/", "/progress", "/charts", "/profile"] as const;

type SlideDirection = "left" | "right" | "none";

function getSlideDirection(from: string, to: string): SlideDirection {
  const fromIndex = TAB_ORDER.indexOf(from as (typeof TAB_ORDER)[number]);
  const toIndex = TAB_ORDER.indexOf(to as (typeof TAB_ORDER)[number]);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return "none";
  }

  return toIndex > fromIndex ? "right" : "left";
}

export function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const previousPath = useRef(location.pathname);
  const directionRef = useRef<SlideDirection>("none");

  if (location.pathname !== previousPath.current) {
    directionRef.current = getSlideDirection(previousPath.current, location.pathname);
    previousPath.current = location.pathname;
  }

  useLayoutEffect(() => {
    const scroll = document.querySelector(".home__scroll");
    if (scroll instanceof HTMLElement) {
      scroll.scrollTop = 0;
    }
  }, [location.pathname]);

  const direction = directionRef.current;

  return (
    <div
      key={location.pathname}
      className={[
        "home__page",
        direction === "none" ? "" : `home__page--from-${direction}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {outlet}
    </div>
  );
}
