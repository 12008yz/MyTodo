const SCROLL_PADDING_PX = 12;

export function getScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;

  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

function clampScrollTop(scrollParent: HTMLElement, value: number): number {
  const max = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
  return Math.max(0, Math.min(value, max));
}

function getVisibleViewportBottom(scrollParent: HTMLElement): number {
  const parentRect = scrollParent.getBoundingClientRect();
  const viewport = window.visualViewport;

  if (viewport) {
    const viewportBottom = viewport.offsetTop + viewport.height;
    return Math.min(parentRect.bottom, viewportBottom) - SCROLL_PADDING_PX;
  }

  return parentRect.bottom - SCROLL_PADDING_PX;
}

function getVisibleViewportTop(scrollParent: HTMLElement): number {
  const parentRect = scrollParent.getBoundingClientRect();
  const viewport = window.visualViewport;

  if (viewport) {
    const viewportTop = viewport.offsetTop;
    return Math.max(parentRect.top, viewportTop) + SCROLL_PADDING_PX;
  }

  return parentRect.top + SCROLL_PADDING_PX;
}

function getScrollTarget(element: HTMLElement): HTMLElement {
  return (
    element.querySelector<HTMLElement>("input, textarea, select") ??
    element.querySelector<HTMLElement>(".collapsible-reveal") ??
    element.querySelector<HTMLElement>(".onboarding__setup-block") ??
    element
  );
}

function scrollElementIntoScrollParent(element: HTMLElement): void {
  const scrollParent = getScrollParent(element);
  if (!scrollParent) return;

  const target = getScrollTarget(element);
  const saved = scrollParent.scrollTop;
  const targetRect = target.getBoundingClientRect();
  const visibleBottom = getVisibleViewportBottom(scrollParent);
  const visibleTop = getVisibleViewportTop(scrollParent);

  let delta = 0;
  if (targetRect.bottom > visibleBottom) {
    delta = targetRect.bottom - visibleBottom;
  }
  if (targetRect.top < visibleTop) {
    delta += targetRect.top - visibleTop;
  }

  if (Math.abs(delta) >= 1) {
    scrollParent.scrollTop = clampScrollTop(scrollParent, saved + delta);
  }
}

/** How far scrollTop must change once the panel is fully open. */
export function measureScrollDeltaForPanel(
  scrollParent: HTMLElement,
  panelOuter: HTMLElement,
  panelHeightPx: number,
): number {
  const savedScroll = scrollParent.scrollTop;
  const savedHeight = panelOuter.style.height;

  panelOuter.style.height = `${panelHeightPx}px`;
  void panelOuter.offsetHeight;

  const panelBottom = panelOuter.getBoundingClientRect().bottom;
  const visibleBottom = getVisibleViewportBottom(scrollParent);

  let delta = 0;
  if (panelBottom > visibleBottom) {
    delta = panelBottom - visibleBottom;
  }

  const panelTop = panelOuter.getBoundingClientRect().top;
  const visibleTop = getVisibleViewportTop(scrollParent);
  if (panelTop < visibleTop) {
    delta += panelTop - visibleTop;
  }

  panelOuter.style.height = savedHeight;
  scrollParent.scrollTop = savedScroll;

  return delta;
}

export function applyScrollDelta(scrollParent: HTMLElement, delta: number): void {
  if (Math.abs(delta) < 1) return;
  scrollParent.scrollTop = clampScrollTop(scrollParent, scrollParent.scrollTop + delta);
}

/** After inner step changes (e.g. «Да» → input). */
export function scrollPanelIntoView(element: HTMLElement | null) {
  if (!element) return;

  requestAnimationFrame(() => {
    scrollElementIntoScrollParent(element);
  });
}

/** Re-scroll while the mobile keyboard opens (visualViewport resize). */
export function scrollPanelIntoViewAfterKeyboard(element: HTMLElement | null) {
  if (!element) return;

  const run = () => scrollElementIntoScrollParent(element);

  requestAnimationFrame(run);
  window.setTimeout(run, 120);
  window.setTimeout(run, 320);

  const viewport = window.visualViewport;
  if (!viewport) return;

  const onViewportChange = () => run();
  viewport.addEventListener("resize", onViewportChange);
  viewport.addEventListener("scroll", onViewportChange);

  window.setTimeout(() => {
    viewport.removeEventListener("resize", onViewportChange);
    viewport.removeEventListener("scroll", onViewportChange);
  }, 900);
}
