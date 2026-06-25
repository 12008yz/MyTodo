import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./FocusScreen.css";

const PREP_OPTIONS = [
  { label: "30 сек", seconds: 30 },
  { label: "1 мин", seconds: 60 },
  { label: "3 мин", seconds: 180 },
  { label: "5 мин", seconds: 300 },
] as const;

type FocusScreenProps = {
  isOpen: boolean;
  habitName: string;
  plannedMin: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  isPaused: boolean;
  skipPrep: boolean;
  canStopEarly: boolean;
  onBeginSession: () => void;
  onTogglePause: () => void;
  onStopEarly: () => void;
  onClose: () => void;
};

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function FocusScreen({
  isOpen,
  habitName,
  plannedMin,
  remainingSeconds,
  elapsedSeconds,
  isPaused,
  skipPrep,
  canStopEarly,
  onBeginSession,
  onTogglePause,
  onStopEarly,
  onClose,
}: FocusScreenProps) {
  const [prepPhase, setPrepPhase] = useState<"idle" | "selecting" | "running" | "done">(
    skipPrep ? "done" : "idle",
  );
  const [prepTotalSeconds, setPrepTotalSeconds] = useState(0);
  const [prepRemainingSeconds, setPrepRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setPrepPhase(skipPrep ? "done" : "idle");
      setPrepTotalSeconds(0);
      setPrepRemainingSeconds(0);
      return;
    }

    setPrepPhase(skipPrep ? "done" : "idle");
    setPrepTotalSeconds(0);
    setPrepRemainingSeconds(0);
  }, [isOpen, skipPrep]);

  useEffect(() => {
    if (prepPhase !== "running" || prepRemainingSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setPrepRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [prepPhase, prepRemainingSeconds]);

  useEffect(() => {
    if (prepPhase === "running" && prepRemainingSeconds === 0 && prepTotalSeconds > 0) {
      setPrepPhase("done");
      onBeginSession();
    }
  }, [onBeginSession, prepPhase, prepRemainingSeconds, prepTotalSeconds]);

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

  const sessionTotalSeconds = Math.max(1, Math.round(plannedMin * 60));
  const safeRemaining = Math.max(0, remainingSeconds);

  const isPrepActive = prepPhase === "running";
  const showPrepSetup = !skipPrep && prepPhase !== "done" && !isPrepActive;
  const showSessionControls = prepPhase === "done";

  const displaySeconds = isPrepActive ? prepRemainingSeconds : safeRemaining;
  const displayTotal = isPrepActive ? prepTotalSeconds : sessionTotalSeconds;
  const progress = displayTotal > 0 ? 1 - displaySeconds / displayTotal : 0;

  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const beginSession = () => {
    setPrepPhase("done");
    onBeginSession();
  };

  const startPrep = (seconds: number) => {
    setPrepTotalSeconds(seconds);
    setPrepRemainingSeconds(seconds);
    setPrepPhase("running");
  };

  return createPortal(
    <div className="focus-screen" role="dialog" aria-modal="true" aria-labelledby="focus-screen-title">
      <div className="focus-screen__panel">
        <button
          type="button"
          className="focus-screen__close"
          onClick={onClose}
          aria-label="Закрыть таймер"
        >
          ×
        </button>
        <p className="focus-screen__eyebrow">
          {isPrepActive ? "Время на подготовку" : "Сессия фокуса"}
        </p>
        <p id="focus-screen-title" className="focus-screen__habit">
          {habitName}
        </p>

        <div
          className={[
            "focus-screen__ring-wrap",
            isPaused && showSessionControls ? "focus-screen__ring-wrap--paused" : "",
            isPrepActive ? "focus-screen__ring-wrap--prep" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <svg className="focus-screen__ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="focus-screen__ring-track" cx="100" cy="100" r={radius} />
            <circle
              className={[
                "focus-screen__ring-progress",
                isPrepActive ? "focus-screen__ring-progress--prep" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              cx="100"
              cy="100"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <p className="focus-screen__timer" aria-live="polite">
            {formatCountdown(displaySeconds)}
          </p>
        </div>

        {showSessionControls ? (
          <p className="focus-screen__meta">
            {isPaused ? "На паузе" : "Осталось"} · прошло {formatCountdown(elapsedSeconds)}
          </p>
        ) : isPrepActive ? (
          <p className="focus-screen__meta">Соберитесь — скоро начнём упражнение</p>
        ) : (
          <p className="focus-screen__meta">Можно взять время на подготовку или начать сразу</p>
        )}

        {showPrepSetup ? (
          <div className="focus-screen__prep">
            {prepPhase === "selecting" ? (
              <>
                <p className="focus-screen__prep-label">Сколько времени нужно?</p>
                <div className="focus-screen__prep-chips">
                  {PREP_OPTIONS.map((option) => (
                    <button
                      key={option.seconds}
                      type="button"
                      className="focus-screen__prep-chip"
                      onClick={() => startPrep(option.seconds)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="focus-screen__btn focus-screen__btn--ghost focus-screen__prep-back"
                  onClick={() => setPrepPhase("idle")}
                >
                  Назад
                </button>
              </>
            ) : (
              <div className="focus-screen__actions focus-screen__actions--prep">
                <button
                  type="button"
                  className="focus-screen__btn focus-screen__btn--prep"
                  onClick={() => setPrepPhase("selecting")}
                >
                  Время на подготовку
                </button>
                <button
                  type="button"
                  className="focus-screen__btn focus-screen__btn--primary"
                  onClick={beginSession}
                >
                  Начать упражнение
                </button>
              </div>
            )}
          </div>
        ) : null}

        {showSessionControls ? (
          <div className="focus-screen__actions">
            <button
              type="button"
              className="focus-screen__btn focus-screen__btn--ghost"
              onClick={onTogglePause}
            >
              {isPaused ? "Продолжить" : "Пауза"}
            </button>
            <button
              type="button"
              className="focus-screen__btn focus-screen__btn--primary"
              disabled={!canStopEarly}
              onClick={onStopEarly}
            >
              Закончил раньше
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
