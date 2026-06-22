import { useCallback, useEffect, useRef, useState } from "react";
import { getContentTransitionDurationMs } from "../constants/transitions";
import { useContentEnterAnimation } from "../components/WelcomeLayout/useContentEnterAnimation";

export type SwitchPhase = "idle" | "exiting" | "entering";
export type PanelVisualState = "visible" | "inactive" | "exiting";

export function getPanelVisualState<T>(
  panel: T,
  current: T,
  switchPhase: SwitchPhase,
): PanelVisualState {
  if (switchPhase === "exiting") {
    return panel === current ? "exiting" : "inactive";
  }

  return panel === current ? "visible" : "inactive";
}

type UseContentSwitchTransitionOptions<T> = {
  activeKey: T;
  onActiveKeyChange: (key: T) => void;
  disabled?: boolean;
};

export function useContentSwitchTransition<T>({
  activeKey,
  onActiveKeyChange,
  disabled = false,
}: UseContentSwitchTransitionOptions<T>) {
  const [switchPhase, setSwitchPhase] = useState<SwitchPhase>("idle");
  const [pendingKey, setPendingKey] = useState<T | null>(null);
  const [exitActive, setExitActive] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enterPending = useContentEnterAnimation(
    wrapperRef,
    switchPhase === "entering",
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishEntering = useCallback(() => {
    setSwitchPhase("idle");
  }, []);

  const switchTo = useCallback(
    (to: T) => {
      if (switchPhase !== "idle" || activeKey === to || disabled) {
        return;
      }

      setPendingKey(to);
      setSwitchPhase("exiting");
    },
    [activeKey, disabled, switchPhase],
  );

  useEffect(() => {
    if (switchPhase !== "exiting" || pendingKey === null) {
      setExitActive(false);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : getContentTransitionDurationMs();

    setExitActive(false);

    let outerFrame = 0;
    let innerFrame = 0;

    outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        setExitActive(true);
      });
    });

    timerRef.current = setTimeout(() => {
      onActiveKeyChange(pendingKey);
      setPendingKey(null);
      setExitActive(false);
      setSwitchPhase("entering");
    }, duration);

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
      clearTimer();
    };
  }, [clearTimer, onActiveKeyChange, pendingKey, switchPhase]);

  useEffect(() => {
    if (switchPhase !== "entering" || enterPending) return;

    const element = wrapperRef.current;
    if (!element) {
      finishEntering();
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      finishEntering();
      return;
    }

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== element || event.propertyName !== "opacity") return;
      finishEntering();
    };

    element.addEventListener("transitionend", onTransitionEnd);
    timerRef.current = setTimeout(finishEntering, getContentTransitionDurationMs() + 50);

    return () => {
      element.removeEventListener("transitionend", onTransitionEnd);
      clearTimer();
    };
  }, [clearTimer, enterPending, finishEntering, switchPhase]);

  useEffect(() => clearTimer, [clearTimer]);

  const getPanelClassName = useCallback(
    (panel: T, baseClass: string) => {
      const state = getPanelVisualState(panel, activeKey, switchPhase);

      return [
        baseClass,
        state === "inactive" ? `${baseClass}--inactive` : "",
        state === "exiting" ? `${baseClass}--exiting` : "",
        state === "exiting" && exitActive ? `${baseClass}--exit-active` : "",
      ]
        .filter(Boolean)
        .join(" ");
    },
    [activeKey, exitActive, switchPhase],
  );

  const getTransitionModifiers = useCallback(
    (baseClass: string, { includeEnter = true }: { includeEnter?: boolean } = {}) => {
      const state = getPanelVisualState(activeKey, activeKey, switchPhase);

      return [
        state === "exiting" ? `${baseClass}--exiting` : "",
        state === "exiting" && exitActive ? `${baseClass}--exit-active` : "",
        includeEnter && enterPending ? `${baseClass}--enter-pending` : "",
      ]
        .filter(Boolean)
        .join(" ");
    },
    [activeKey, enterPending, exitActive, switchPhase],
  );

  const wrapperClassName = [
    "content-panels",
    enterPending ? "content-panels--enter-pending" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    wrapperRef,
    wrapperClassName,
    switchTo,
    switchPhase,
    getPanelClassName,
    getTransitionModifiers,
    getPanelState: (panel: T) => getPanelVisualState(panel, activeKey, switchPhase),
    isTransitioning: switchPhase !== "idle",
  };
}
