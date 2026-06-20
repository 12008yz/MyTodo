import type { ReactNode } from "react";
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

  return (
    <div className={`onboarding-shell onboarding-shell--${theme}`}>
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
