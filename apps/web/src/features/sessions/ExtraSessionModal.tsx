import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { HabitUnit } from "@mytodo/shared";
import {
  adjustExtraSessionPlan,
  canDecreaseExtraSession,
  canIncreaseExtraSession,
  formatExtraSessionDuration,
  formatSessionCountdown,
  sessionPlanTotalSeconds,
  type SessionPlan,
} from "./sessionPlan";
import "./FocusScreen.css";
import "./ExtraSessionModal.css";

type ExtraSessionModalProps = {
  isOpen: boolean;
  habitName: string;
  unit: HabitUnit;
  goal: number;
  defaultPlan: SessionPlan;
  isStarting?: boolean;
  onClose: () => void;
  onConfirm: (plan: SessionPlan) => void;
};

export function ExtraSessionModal({
  isOpen,
  habitName,
  unit,
  goal,
  defaultPlan,
  isStarting = false,
  onClose,
  onConfirm,
}: ExtraSessionModalProps) {
  const [plan, setPlan] = useState(defaultPlan);

  useEffect(() => {
    if (isOpen) {
      setPlan(defaultPlan);
    }
  }, [defaultPlan, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const totalSeconds = sessionPlanTotalSeconds(plan);
  const radius = 88;
  const circumference = 2 * Math.PI * radius;

  return createPortal(
    <div
      className="focus-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extra-session-title"
    >
      <div className="focus-screen__panel">
        <button
          type="button"
          className="focus-screen__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
        <p className="focus-screen__eyebrow">Ещё сессия</p>
        <p id="extra-session-title" className="focus-screen__habit">
          {habitName}
        </p>

        <div className="extra-session-modal__timer-row" aria-label="Длительность сессии">
          <button
            type="button"
            className="extra-session-modal__step"
            disabled={isStarting || !canDecreaseExtraSession(plan, unit)}
            aria-label="Уменьшить длительность"
            onClick={() => setPlan((current) => adjustExtraSessionPlan(current, unit, -1, goal))}
          >
            −
          </button>

          <div className="focus-screen__ring-wrap extra-session-modal__ring">
            <svg className="focus-screen__ring" viewBox="0 0 200 200" aria-hidden="true">
              <circle className="focus-screen__ring-track" cx="100" cy="100" r={radius} />
              <circle
                className="focus-screen__ring-progress"
                cx="100"
                cy="100"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={0}
              />
            </svg>
            <p className="focus-screen__timer" aria-live="polite">
              {formatSessionCountdown(totalSeconds)}
            </p>
          </div>

          <button
            type="button"
            className="extra-session-modal__step"
            disabled={isStarting || !canIncreaseExtraSession(plan, unit, goal)}
            aria-label="Увеличить длительность"
            onClick={() => setPlan((current) => adjustExtraSessionPlan(current, unit, 1, goal))}
          >
            +
          </button>
        </div>

        <p className="focus-screen__meta extra-session-modal__hint">
          {formatExtraSessionDuration(plan, unit)}
        </p>

        <div className="focus-screen__actions">
          <button
            type="button"
            className="focus-screen__btn focus-screen__btn--primary"
            disabled={isStarting}
            onClick={() => onConfirm(plan)}
          >
            Начать
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
