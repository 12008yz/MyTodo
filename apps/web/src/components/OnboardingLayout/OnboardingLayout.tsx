import { useEffect, useRef, useState, type ReactNode } from "react";
import "./OnboardingLayout.css";

export type OnboardingTheme = "default" | "light" | "dark" | "finale";

type OnboardingLayoutProps = {
  children: ReactNode;
  progress: number;
  theme?: OnboardingTheme;
};

export function OnboardingLayout({
  children,
  progress,
  theme = "default",
}: OnboardingLayoutProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const shellRef = useRef<HTMLDivElement>(null);
  const [enterReady, setEnterReady] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const enterPending = !enterReady;

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setEnterReady(true);
      return;
    }

    let outerFrame = 0;
    let innerFrame = 0;

    outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        const element = shellRef.current;
        if (element) void element.offsetHeight;
        setEnterReady(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, []);

  const shellClassName = [
    "onboarding-shell",
    `onboarding-shell--${theme}`,
    enterPending ? "onboarding-shell--enter-pending" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={shellRef} className={shellClassName}>
      <div className="onboarding-shell__inner">
        <div
          className="onboarding-shell__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamped}
        >
          <div
            className="onboarding-shell__progress-fill"
            style={{ width: `${clamped}%` }}
          />
        </div>
        <div className="onboarding-shell__body">{children}</div>
      </div>
    </div>
  );
}
