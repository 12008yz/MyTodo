import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  applyScrollDelta,
  getScrollParent,
  measureScrollDeltaForPanel,
} from "../../utils/scrollPanelIntoView";
import "./CollapsibleReveal.css";

export type CollapsibleRevealProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onExpanded?: () => void;
  onCollapsed?: () => void;
  scrollAnchorRef?: RefObject<HTMLElement | null>;
  /** Skip animation when a parent transition is already running */
  immediate?: boolean;
};

const DURATION_OPEN_MS = 420;
const DURATION_CLOSE_MS = 360;
const CONTENT_OFFSET_PX = 6;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2.6);
}

function clearInlineStyles(element: HTMLElement) {
  element.style.height = "";
  element.style.opacity = "";
  element.style.transform = "";
}

function runInstant(
  outer: HTMLDivElement,
  inner: HTMLDivElement,
  open: boolean,
  scrollParent: HTMLElement | null,
  panelHeight: number,
  onExpanded?: () => void,
  onCollapsed?: () => void,
) {
  clearInlineStyles(outer);
  clearInlineStyles(inner);

  if (open) {
    outer.style.height = "auto";
    inner.style.opacity = "1";
    inner.style.transform = "translateY(0)";
    if (scrollParent) {
      const delta = measureScrollDeltaForPanel(scrollParent, outer, panelHeight);
      applyScrollDelta(scrollParent, delta);
    }
    onExpanded?.();
    return;
  }

  outer.style.height = "0px";
  inner.style.opacity = "0";
  inner.style.transform = `translateY(-${CONTENT_OFFSET_PX}px)`;
  onCollapsed?.();
}

function animateOpen(
  outer: HTMLDivElement,
  inner: HTMLDivElement,
  signal: AbortSignal,
  scrollParent: HTMLElement | null,
  onExpanded?: () => void,
): Promise<void> {
  outer.style.height = "0px";
  inner.style.opacity = "0";
  inner.style.transform = `translateY(-${CONTENT_OFFSET_PX}px)`;

  const targetHeight = inner.offsetHeight;
  if (targetHeight <= 0) {
    outer.style.height = "auto";
    inner.style.opacity = "1";
    inner.style.transform = "translateY(0)";
    return Promise.resolve();
  }

  const scrollDelta =
    scrollParent != null
      ? measureScrollDeltaForPanel(scrollParent, outer, targetHeight)
      : 0;
  const startScroll = scrollParent?.scrollTop ?? 0;
  const startTime = performance.now();

  return new Promise((resolve) => {
    let frame = 0;

    const finish = () => {
      cancelAnimationFrame(frame);
      outer.style.height = `${targetHeight}px`;
      inner.style.opacity = "1";
      inner.style.transform = "translateY(0)";

      if (scrollParent) {
        const targetScroll = startScroll + scrollDelta;
        scrollParent.scrollTop = targetScroll;
        outer.style.height = "auto";
        scrollParent.scrollTop = targetScroll;
      } else {
        outer.style.height = "auto";
      }

      clearInlineStyles(inner);
      onExpanded?.();
      resolve();
    };

    const step = (now: number) => {
      if (signal.aborted) {
        finish();
        return;
      }

      const t = Math.min(1, (now - startTime) / DURATION_OPEN_MS);
      const e = easeOut(t);

      outer.style.height = `${targetHeight * e}px`;
      inner.style.opacity = String(e);
      inner.style.transform = `translateY(-${CONTENT_OFFSET_PX * (1 - e)}px)`;

      if (scrollParent) {
        scrollParent.scrollTop = startScroll + scrollDelta * e;
      }

      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        finish();
      }
    };

    frame = requestAnimationFrame(step);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function animateClose(
  outer: HTMLDivElement,
  inner: HTMLDivElement,
  signal: AbortSignal,
  storedHeight: number,
): Promise<void> {
  const currentHeight = Math.max(outer.offsetHeight, storedHeight, inner.offsetHeight);
  outer.style.height = `${currentHeight}px`;
  inner.style.opacity = "1";
  inner.style.transform = "translateY(0)";

  const startTime = performance.now();

  return new Promise((resolve) => {
    let frame = 0;

    const finish = () => {
      cancelAnimationFrame(frame);
      outer.style.height = "0px";
      inner.style.opacity = "";
      inner.style.transform = "";
      resolve();
    };

    const step = (now: number) => {
      if (signal.aborted) {
        finish();
        return;
      }

      const t = Math.min(1, (now - startTime) / DURATION_CLOSE_MS);
      const e = 1 - Math.pow(1 - t, 2.2);

      outer.style.height = `${currentHeight * (1 - e)}px`;
      inner.style.opacity = String(1 - e);
      inner.style.transform = `translateY(-${CONTENT_OFFSET_PX * e}px)`;

      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        finish();
      }
    };

    frame = requestAnimationFrame(step);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export function CollapsibleReveal({
  open,
  children,
  className,
  contentClassName,
  onExpanded,
  onCollapsed,
  immediate = false,
  scrollAnchorRef,
}: CollapsibleRevealProps) {
  const [rendered, setRendered] = useState(open);
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const frozenChildrenRef = useRef(children);
  const storedHeightRef = useRef(0);
  const runIdRef = useRef(0);
  const onExpandedRef = useRef(onExpanded);
  const onCollapsedRef = useRef(onCollapsed);

  onExpandedRef.current = onExpanded;
  onCollapsedRef.current = onCollapsed;

  if (open) {
    frozenChildrenRef.current = children;
  }

  useLayoutEffect(() => {
    if (!open || !rendered) return;

    const outer = outerRef.current;
    if (!outer) return;

    const height = outer.offsetHeight;
    if (height > 0) {
      storedHeightRef.current = height;
    }
  }, [open, rendered]);

  useLayoutEffect(() => {
    if (open) {
      if (!rendered) {
        setRendered(true);
      }
      return;
    }

    if (!rendered) {
      return;
    }

    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const runId = ++runIdRef.current;
    const controller = new AbortController();
    const reduced = prefersReducedMotion() || immediate;
    const closeHeight = storedHeightRef.current;

    const finish = () => {
      if (runIdRef.current !== runId) return;
      storedHeightRef.current = 0;
      setRendered(false);
      requestAnimationFrame(() => {
        if (runIdRef.current !== runId) return;
        onCollapsedRef.current?.();
      });
    };

    if (reduced) {
      runInstant(outer, inner, false, null, 0, undefined, finish);
      return () => controller.abort();
    }

    void animateClose(outer, inner, controller.signal, closeHeight).then(finish);
    return () => controller.abort();
  }, [immediate, open, rendered]);

  useLayoutEffect(() => {
    if (!open || !rendered) return;

    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const runId = ++runIdRef.current;
    const controller = new AbortController();
    const reduced = prefersReducedMotion() || immediate;

    const anchor = scrollAnchorRef?.current ?? outer.closest<HTMLElement>(".onboarding__habit-item");
    const scrollParent = anchor ? getScrollParent(anchor) : null;
    const panelHeight = inner.offsetHeight;

    if (reduced) {
      runInstant(outer, inner, true, scrollParent, panelHeight, () => {
        if (runIdRef.current !== runId) return;
        onExpandedRef.current?.();
      });
      return () => controller.abort();
    }

    void animateOpen(outer, inner, controller.signal, scrollParent, () => {
      if (runIdRef.current !== runId) return;
      onExpandedRef.current?.();
    });

    return () => controller.abort();
  }, [immediate, open, rendered, scrollAnchorRef]);

  if (!rendered) {
    return null;
  }

  return (
    <div
      ref={outerRef}
      className={["collapsible-reveal", open ? "collapsible-reveal--open" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div ref={innerRef} className="collapsible-reveal__inner">
        <div className={["collapsible-reveal__content", contentClassName].filter(Boolean).join(" ")}>
          {frozenChildrenRef.current}
        </div>
      </div>
    </div>
  );
}
