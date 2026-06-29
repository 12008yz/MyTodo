import { useCallback, useEffect, useRef, useState, type TransitionEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AUTH_PAGE_SHELL_DELAY_MS,
  AUTH_PAGE_TRANSITION_DURATION_MS,
} from "../constants/transitions";
import { useAuth } from "../features/auth/AuthProvider";

export type AuthLeavePhase = "idle" | "armed" | "active";

export function useAuthPageTransition() {
  const navigate = useNavigate();
  const { setAuthExitBlocked } = useAuth();
  const [leavePhase, setLeavePhase] = useState<AuthLeavePhase>("idle");
  const leavePhaseRef = useRef<AuthLeavePhase>("idle");
  const pendingPathRef = useRef<string | null>(null);
  const finishingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef({ outer: 0, inner: 0 });

  const setLeavePhaseSafe = useCallback((phase: AuthLeavePhase) => {
    leavePhaseRef.current = phase;
    setLeavePhase(phase);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishExit = useCallback(() => {
    if (finishingRef.current) return;

    const to = pendingPathRef.current;
    if (!to) return;

    finishingRef.current = true;
    pendingPathRef.current = null;
    navigate(to, { replace: true });
    setAuthExitBlocked(false);
    setLeavePhaseSafe("idle");
    clearTimer();
    finishingRef.current = false;
  }, [clearTimer, navigate, setAuthExitBlocked, setLeavePhaseSafe]);

  const exitTo = useCallback(
    (to: string) => {
      if (leavePhaseRef.current !== "idle") return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        navigate(to, { replace: true });
        return;
      }

      pendingPathRef.current = to;
      finishingRef.current = false;
      setAuthExitBlocked(true);
      setLeavePhaseSafe("armed");

      frameRef.current.outer = window.requestAnimationFrame(() => {
        frameRef.current.inner = window.requestAnimationFrame(() => {
          setLeavePhaseSafe("active");
          timerRef.current = setTimeout(
            finishExit,
            AUTH_PAGE_TRANSITION_DURATION_MS + AUTH_PAGE_SHELL_DELAY_MS + 100,
          );
        });
      });
    },
    [finishExit, navigate, setAuthExitBlocked, setLeavePhaseSafe],
  );

  const handleLeaveTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (leavePhaseRef.current !== "active") return;
      if (event.target !== event.currentTarget) return;
      if (event.propertyName !== "opacity") return;
      finishExit();
    },
    [finishExit],
  );

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(frameRef.current.outer);
      window.cancelAnimationFrame(frameRef.current.inner);
      clearTimer();
      pendingPathRef.current = null;
      finishingRef.current = false;
      if (leavePhaseRef.current !== "idle") {
        setAuthExitBlocked(false);
        leavePhaseRef.current = "idle";
      }
    };
  }, [clearTimer, setAuthExitBlocked]);

  return {
    exitTo,
    leavePhase,
    isAuthExiting: leavePhase !== "idle",
    onLeaveTransitionEnd: handleLeaveTransitionEnd,
  };
}
