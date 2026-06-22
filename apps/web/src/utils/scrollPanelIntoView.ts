const SCROLL_PADDING_PX = 12;
const KEYBOARD_PADDING_EXTRA_PX = 24;
const PANEL_OPEN_MS = 440;
const SMOOTH_SCROLL_MS = 280;

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

function resolveScrollParent(
  element: HTMLElement,
  scrollContainer?: HTMLElement | null,
): HTMLElement | null {
  return scrollContainer ?? getScrollParent(element);
}

function clampScrollTop(scrollParent: HTMLElement, value: number): number {
  const max = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
  return Math.max(0, Math.min(value, max));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getKeyboardInsetPx(): number {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height);
}

function getVisibleBottom(): number {
  const viewport = window.visualViewport;
  if (viewport) {
    return viewport.offsetTop + viewport.height - SCROLL_PADDING_PX;
  }
  return window.innerHeight - SCROLL_PADDING_PX;
}

function getVisibleTop(): number {
  const viewport = window.visualViewport;
  if (viewport) {
    return viewport.offsetTop + SCROLL_PADDING_PX;
  }
  return SCROLL_PADDING_PX;
}

function getScrollTarget(element: HTMLElement): HTMLElement {
  return (
    element.querySelector<HTMLElement>("input, textarea, select") ??
    element.querySelector<HTMLElement>(".onboarding__setup-block") ??
    element.querySelector<HTMLElement>(".collapsible-reveal") ??
    element
  );
}

export function applyKeyboardScrollPadding(scrollContainer?: HTMLElement | null): void {
  if (!scrollContainer) return;

  const inset = getKeyboardInsetPx();
  scrollContainer.style.paddingBottom =
    inset > 0 ? `${inset + KEYBOARD_PADDING_EXTRA_PX}px` : "";
}

export function clearKeyboardScrollPadding(scrollContainer?: HTMLElement | null): void {
  scrollContainer?.style.removeProperty("padding-bottom");
}

function measureScrollDelta(element: HTMLElement, scrollParent: HTMLElement): number {
  const target = getScrollTarget(element);
  const rect = target.getBoundingClientRect();
  const visibleBottom = getVisibleBottom();
  const scrollParentTop = scrollParent.getBoundingClientRect().top + SCROLL_PADDING_PX;
  const visibleTop = Math.max(getVisibleTop(), scrollParentTop);

  let delta = 0;
  if (rect.bottom > visibleBottom) {
    delta += rect.bottom - visibleBottom;
  }
  if (rect.top < visibleTop) {
    delta += rect.top - visibleTop;
  }

  return delta;
}

function animateScrollTop(scrollParent: HTMLElement, targetTop: number): void {
  const clampedTarget = clampScrollTop(scrollParent, targetTop);
  const start = scrollParent.scrollTop;
  const delta = clampedTarget - start;

  if (Math.abs(delta) < 1) return;

  if (prefersReducedMotion()) {
    scrollParent.scrollTop = clampedTarget;
    return;
  }

  const startTime = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / SMOOTH_SCROLL_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    scrollParent.scrollTop = start + delta * eased;
    if (t < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

function scrollElementIntoScrollParent(
  element: HTMLElement,
  scrollParent: HTMLElement,
  smooth: boolean,
): void {
  const delta = measureScrollDelta(element, scrollParent);
  if (Math.abs(delta) < 1) return;

  const targetTop = scrollParent.scrollTop + delta;
  if (smooth) {
    animateScrollTop(scrollParent, targetTop);
  } else {
    scrollParent.scrollTop = clampScrollTop(scrollParent, targetTop);
  }
}

function runScrollIntoView(
  element: HTMLElement,
  scrollContainer?: HTMLElement | null,
  smooth = true,
): void {
  const scrollParent = resolveScrollParent(element, scrollContainer);
  if (!scrollParent) return;

  applyKeyboardScrollPadding(scrollParent);
  scrollElementIntoScrollParent(element, scrollParent, smooth);
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
  const visibleBottom = Math.min(
    scrollParent.getBoundingClientRect().bottom - SCROLL_PADDING_PX,
    getVisibleBottom(),
  );

  let delta = 0;
  if (panelBottom > visibleBottom) {
    delta = panelBottom - visibleBottom;
  }

  const panelTop = panelOuter.getBoundingClientRect().top;
  const scrollParentTop = scrollParent.getBoundingClientRect().top + SCROLL_PADDING_PX;
  const visibleTop = Math.max(getVisibleTop(), scrollParentTop);
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
export function scrollPanelIntoView(
  element: HTMLElement | null,
  scrollContainer?: HTMLElement | null,
) {
  if (!element) return;

  requestAnimationFrame(() => {
    runScrollIntoView(element, scrollContainer, true);
  });
}

/** One gentle scroll after the keyboard opens — no repeated jumps. */
export function scrollPanelIntoViewAfterKeyboard(
  element: HTMLElement | null,
  scrollContainer?: HTMLElement | null,
) {
  if (!element) return;

  let debounceTimer = 0;
  let viewport: VisualViewport | null = null;

  const run = () => {
    runScrollIntoView(element, scrollContainer, true);
  };

  const scheduleRun = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(run, 80);
  };

  window.setTimeout(run, PANEL_OPEN_MS + 60);

  viewport = window.visualViewport;
  if (!viewport) return;

  viewport.addEventListener("resize", scheduleRun);

  window.setTimeout(() => {
    viewport?.removeEventListener("resize", scheduleRun);
    window.clearTimeout(debounceTimer);
  }, 1200);
}

export function focusSetupInputAfterPanelOpen(
  getInput: () => HTMLInputElement | null,
  onFocused?: () => void,
): () => void {
  let cancelled = false;

  const focus = () => {
    if (cancelled) return;
    const input = getInput();
    if (!input) return;
    input.focus({ preventScroll: true });
    onFocused?.();
  };

  const timer = window.setTimeout(focus, PANEL_OPEN_MS);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
