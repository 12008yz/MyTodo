const SCROLL_PADDING_PX = 12;
const STICKY_BOTTOM_INSET_PX = 88;

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

  const parentRect = scrollParent.getBoundingClientRect();
  const panelBottom = panelOuter.getBoundingClientRect().bottom;
  const visibleBottom = parentRect.bottom - STICKY_BOTTOM_INSET_PX - SCROLL_PADDING_PX;

  let delta = 0;
  if (panelBottom > visibleBottom) {
    delta = panelBottom - visibleBottom;
  }

  const panelTop = panelOuter.getBoundingClientRect().top;
  const visibleTop = parentRect.top + SCROLL_PADDING_PX;
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
    const scrollParent = getScrollParent(element);
    const panel = element.querySelector<HTMLElement>(".collapsible-reveal") ?? element;
    if (!scrollParent) return;

    const saved = scrollParent.scrollTop;
    const parentRect = scrollParent.getBoundingClientRect();
    const panelBottom = panel.getBoundingClientRect().bottom;
    const visibleBottom = parentRect.bottom - STICKY_BOTTOM_INSET_PX - SCROLL_PADDING_PX;

    if (panelBottom > visibleBottom) {
      scrollParent.scrollTop = clampScrollTop(
        scrollParent,
        saved + (panelBottom - visibleBottom),
      );
    }
  });
}
