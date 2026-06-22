import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./CollapsibleReveal.css";

export type CollapsibleRevealProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onExpanded?: () => void;
  onCollapsed?: () => void;
  /** Skip animation when a parent transition is already running */
  immediate?: boolean;
};

const DURATION_OPEN_MS = 420;
const DURATION_CLOSE_MS = 360;
const EASE_OPEN = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_CLOSE = "cubic-bezier(0.4, 0, 0.72, 1)";
const CONTENT_OFFSET_PX = 6;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  onExpanded?: () => void,
  onCollapsed?: () => void,
) {
  clearInlineStyles(outer);
  clearInlineStyles(inner);

  if (open) {
    outer.style.height = "auto";
    inner.style.opacity = "1";
    inner.style.transform = "translateY(0)";
    onExpanded?.();
    return;
  }

  outer.style.height = "0px";
  inner.style.opacity = "0";
  inner.style.transform = `translateY(-${CONTENT_OFFSET_PX}px)`;
  onCollapsed?.();
}

function releaseHeight(outer: HTMLDivElement) {
  outer.style.height = "auto";
}

function animateOpen(
  outer: HTMLDivElement,
  inner: HTMLDivElement,
  signal: AbortSignal,
): Promise<void> {
  outer.style.height = "0px";
  inner.style.opacity = "0";
  inner.style.transform = `translateY(-${CONTENT_OFFSET_PX}px)`;

  const targetHeight = inner.offsetHeight;
  if (targetHeight <= 0) {
    releaseHeight(outer);
    inner.style.opacity = "1";
    inner.style.transform = "translateY(0)";
    return Promise.resolve();
  }

  const heightAnim = outer.animate(
    [{ height: "0px" }, { height: `${targetHeight}px` }],
    { duration: DURATION_OPEN_MS, easing: EASE_OPEN, fill: "forwards" },
  );
  const fadeAnim = inner.animate(
    [
      { opacity: 0, transform: `translateY(-${CONTENT_OFFSET_PX}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: DURATION_OPEN_MS, easing: EASE_OPEN, fill: "forwards" },
  );

  signal.addEventListener("abort", () => {
    heightAnim.cancel();
    fadeAnim.cancel();
  });

  return Promise.all([heightAnim.finished, fadeAnim.finished]).then(() => {
    heightAnim.cancel();
    fadeAnim.cancel();
    releaseHeight(outer);
    clearInlineStyles(inner);
  });
}

function animateClose(
  outer: HTMLDivElement,
  inner: HTMLDivElement,
  signal: AbortSignal,
  storedHeight: number,
): Promise<void> {
  const measured = outer.offsetHeight;
  const currentHeight = Math.max(measured, storedHeight, inner.offsetHeight);

  outer.style.height = `${currentHeight}px`;

  const heightAnim = outer.animate(
    [{ height: `${currentHeight}px` }, { height: "0px" }],
    { duration: DURATION_CLOSE_MS, easing: EASE_CLOSE, fill: "forwards" },
  );

  signal.addEventListener("abort", () => {
    heightAnim.cancel();
  });

  return heightAnim.finished.then(() => {
    heightAnim.cancel();
    outer.style.height = "0px";
    inner.style.opacity = "";
    inner.style.transform = "";
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
  });

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
      runInstant(outer, inner, false, undefined, finish);
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

    if (reduced) {
      runInstant(outer, inner, true, () => {
        if (runIdRef.current !== runId) return;
        onExpandedRef.current?.();
      });
      return () => controller.abort();
    }

    void animateOpen(outer, inner, controller.signal).then(() => {
      if (runIdRef.current !== runId) return;
      onExpandedRef.current?.();
    });

    return () => controller.abort();
  }, [immediate, open, rendered]);

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
