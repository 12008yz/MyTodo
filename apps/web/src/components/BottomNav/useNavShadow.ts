import { useLayoutEffect, useRef } from "react";
const NAV_TAB_PATHS = ["/", "/progress", "/charts", "/profile"] as const;

export function getNavTabIndex(pathname: string): number {
  const index = NAV_TAB_PATHS.indexOf(pathname as (typeof NAV_TAB_PATHS)[number]);
  return index === -1 ? 0 : index;
}

export function useNavShadow(activeIndex: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const shadowRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const shadow = shadowRef.current;
    const activeItem = itemRefs.current[activeIndex];

    if (!container || !shadow || !activeItem) {
      return;
    }

    const update = () => {
      const icon = activeItem.querySelector("img");
      if (!(icon instanceof HTMLImageElement)) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const centerX = iconRect.left - containerRect.left + iconRect.width / 2;
      const centerY = iconRect.top - containerRect.top + iconRect.height / 2;
      const size = Math.max(iconRect.width, iconRect.height) + 10;

      shadow.style.width = `${size}px`;
      shadow.style.height = `${size}px`;
      shadow.style.transform = `translate(${centerX}px, ${centerY}px) translate(-50%, -50%)`;
      shadow.style.opacity = "1";
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(activeItem);

    return () => observer.disconnect();
  }, [activeIndex]);

  return { containerRef, itemRefs, shadowRef };
}
