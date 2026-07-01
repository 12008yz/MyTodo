import { useLayoutEffect, useRef } from "react";

let trackedScrollTop = 0;
let scrollListenerAttached = false;

export function getHomeScrollElement(): HTMLElement | null {
  const scroll = document.querySelector(".home__scroll");
  return scroll instanceof HTMLElement ? scroll : null;
}

function syncTrackedScrollTop(): void {
  const scroll = getHomeScrollElement();
  if (scroll) {
    trackedScrollTop = scroll.scrollTop;
  }
}

export function ensureHomeScrollTracking(): void {
  if (scrollListenerAttached) {
    return;
  }

  const scroll = getHomeScrollElement();
  if (!scroll) {
    return;
  }

  syncTrackedScrollTop();
  scroll.addEventListener("scroll", syncTrackedScrollTop, { passive: true });
  scrollListenerAttached = true;
}

function readTrackedScrollTop(): number {
  ensureHomeScrollTracking();
  syncTrackedScrollTop();
  return trackedScrollTop;
}

function restoreHomeScrollTop(top: number): void {
  const scroll = getHomeScrollElement();
  if (!scroll) {
    return;
  }

  scroll.scrollTop = top;
}

function restoreHomeScrollTopSoon(top: number): () => void {
  restoreHomeScrollTop(top);

  const frameId = requestAnimationFrame(() => restoreHomeScrollTop(top));

  return () => {
    cancelAnimationFrame(frameId);
  };
}

export function runWithPreservedHomeScroll(action: () => void): void {
  const top = readTrackedScrollTop();
  action();
  restoreHomeScrollTopSoon(top);
}

/** После перерисовки графика — не даём браузеру сбросить scroll. */
export function usePreserveHomeScrollAfterChartUpdate(...deps: unknown[]): void {
  const isFirstRenderRef = useRef(true);

  useLayoutEffect(() => {
    ensureHomeScrollTracking();
  }, []);

  useLayoutEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const top = readTrackedScrollTop();
    return restoreHomeScrollTopSoon(top);
  }, deps);
}
