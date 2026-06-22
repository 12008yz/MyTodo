import { useCallback, useEffect, useRef, useState } from "react";
import { getContentTransitionDurationMs } from "../../constants/transitions";
import { LoginPage } from "../../pages/LoginPage/LoginPage";
import { RegistrationPage } from "../../pages/RegisterPage/RegistrationPage";
import { useContentEnterAnimation } from "../WelcomeLayout/useContentEnterAnimation";
import "./AuthPanels.css";

export type AuthPanel = "login" | "registration";

export type PanelVisualState = "visible" | "inactive" | "exiting";

type SwitchPhase = "idle" | "exiting" | "entering";

type AuthPanelsProps = {
  showContent: boolean;
  prehidden: boolean;
  activePanel: AuthPanel;
  onPanelChange: (panel: AuthPanel) => void;
  onLogin: (data: { email: string; password: string }) => Promise<void>;
  onRegister: (data: { email: string; password: string; name: string }) => Promise<void>;
  authError?: string | null;
  pending?: boolean;
};

function getPanelState(
  panel: AuthPanel,
  current: AuthPanel,
  switchPhase: SwitchPhase,
): PanelVisualState {
  if (switchPhase === "exiting") {
    return panel === current ? "exiting" : "inactive";
  }

  return panel === current ? "visible" : "inactive";
}

export function AuthPanels({
  showContent,
  prehidden,
  activePanel,
  onPanelChange,
  onLogin,
  onRegister,
  authError,
  pending = false,
}: AuthPanelsProps) {
  const [switchPhase, setSwitchPhase] = useState<SwitchPhase>("idle");
  const [pendingPanel, setPendingPanel] = useState<AuthPanel | null>(null);
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

  const switchPanel = useCallback(
    (to: AuthPanel) => {
      if (switchPhase !== "idle" || activePanel === to || prehidden || !showContent) {
        return;
      }

      setPendingPanel(to);
      setSwitchPhase("exiting");
    },
    [activePanel, prehidden, showContent, switchPhase],
  );

  useEffect(() => {
    if (switchPhase !== "exiting" || !pendingPanel) {
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
      onPanelChange(pendingPanel);
      setPendingPanel(null);
      setExitActive(false);
      setSwitchPhase("entering");
    }, duration);

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
      clearTimer();
    };
  }, [clearTimer, onPanelChange, pendingPanel, switchPhase]);

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

  useEffect(() => {
    if (!prehidden) return;

    clearTimer();
    setPendingPanel(null);
    setExitActive(false);
    setSwitchPhase("idle");
  }, [clearTimer, prehidden]);

  useEffect(() => clearTimer, [clearTimer]);

  const wrapperClassName = [
    "auth-panels",
    prehidden ? "auth-panels--prehidden" : "",
    enterPending ? "auth-panels--enter-pending" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={wrapperRef} className={wrapperClassName}>
      <LoginPage
        showContent={showContent}
        panelState={getPanelState("login", activePanel, switchPhase)}
        exitActive={exitActive}
        onRegistration={() => switchPanel("registration")}
        onSubmit={onLogin}
        error={activePanel === "login" ? authError : null}
        pending={pending}
      />
      <RegistrationPage
        showContent={showContent}
        panelState={getPanelState("registration", activePanel, switchPhase)}
        exitActive={exitActive}
        onLogin={() => switchPanel("login")}
        onSubmit={onRegister}
        error={activePanel === "registration" ? authError : null}
        pending={pending}
      />
    </div>
  );
}
