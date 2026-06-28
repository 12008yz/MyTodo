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
  plannedSeconds?: number | null;
  remainingSeconds: number;
  isPaused: boolean;
  skipPrep: boolean;
  /** Fixed prep countdown (e.g. plank): user taps Start, then this many seconds, then the session. */
  autoPrepSeconds?: number | null;
  prepLabel?: string;
  sessionActive?: boolean;
  canStopEarly: boolean;
  showCompletionBurst?: boolean;
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

function formatPrepDuration(seconds: number): string {
  if (seconds === 1) {
    return "1 секунду";
  }

  if (seconds >= 2 && seconds <= 4) {
    return `${seconds} секунды`;
  }

  return `${seconds} секунд`;
}

export function FocusScreen({
  isOpen,
  habitName,
  plannedMin,
  plannedSeconds = null,
  remainingSeconds,
  isPaused,
  skipPrep,
  autoPrepSeconds = null,
  prepLabel = "Соберитесь — скоро начнём упражнение",
  sessionActive = false,
  canStopEarly,
  showCompletionBurst = false,
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

    if (skipPrep) {
      setPrepPhase("done");
      setPrepTotalSeconds(0);
      setPrepRemainingSeconds(0);
      return;
    }

    setPrepPhase("idle");
    setPrepTotalSeconds(0);
    setPrepRemainingSeconds(0);
  }, [isOpen, skipPrep]);

  useEffect(() => {
    if (prepPhase !== "running") {
      return;
    }

    const timerId = window.setInterval(() => {
      setPrepRemainingSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [prepPhase]);

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

  const sessionTotalSeconds =
    plannedSeconds != null && plannedSeconds > 0
      ? plannedSeconds
      : Math.max(1, Math.round(plannedMin * 60));
  const fixedPrepSeconds =
    !skipPrep && autoPrepSeconds != null && autoPrepSeconds > 0 ? autoPrepSeconds : null;
  const safeRemaining = Math.max(0, remainingSeconds);

  const isPrepActive = prepPhase === "running";
  const showFixedPrepReady = fixedPrepSeconds != null && prepPhase === "idle";
  const showPrepSetup = !skipPrep && prepPhase !== "done" && !isPrepActive && !showFixedPrepReady;
  const showSessionControls = prepPhase === "done";

  const displaySeconds = isPrepActive
    ? prepRemainingSeconds
    : showFixedPrepReady
      ? sessionTotalSeconds
      : safeRemaining;
  const displayTotal = isPrepActive ? prepTotalSeconds : sessionTotalSeconds;
  const remainingRatio =
    displayTotal > 0 ? Math.max(0, Math.min(1, displaySeconds / displayTotal)) : 0;
  const progress = isPrepActive
    ? remainingRatio
    : showFixedPrepReady
      ? 1
      : 1 - remainingRatio;

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
          disabled={showCompletionBurst}
        >
          ×
        </button>
        <p className="focus-screen__eyebrow">
          {showCompletionBurst
            ? "Выполнено"
            : isPrepActive
              ? "Время на подготовку"
              : showFixedPrepReady
                ? "Готовы к старту"
                : "Сессия фокуса"}
        </p>
        <p id="focus-screen-title" className="focus-screen__habit">
          {habitName}
        </p>

        {showCompletionBurst ? (
          <div className="focus-screen__success" aria-live="polite">
            <div className="focus-screen__success-burst" aria-hidden="true">
              <svg className="focus-screen__success-icon" viewBox="0 0 72 72">
                <circle className="focus-screen__success-circle" cx="36" cy="36" r="32" />
                <path className="focus-screen__success-check" d="M22 37 l10 10 18-20" />
              </svg>
            </div>
            <p className="focus-screen__success-title">Готово!</p>
            <p className="focus-screen__success-hint">
              <span className="focus-screen__success-arrow" aria-hidden="true">
                ↓
              </span>
              Переносим в выполненные
            </p>
          </div>
        ) : (
          <div
            className={[
              "focus-screen__ring-wrap",
              isPaused && showSessionControls ? "focus-screen__ring-wrap--paused" : "",
              isPrepActive ? "focus-screen__ring-wrap--prep" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <svg
              className={[
                "focus-screen__ring",
                isPrepActive ? "focus-screen__ring--prep" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              viewBox="0 0 200 200"
              aria-hidden="true"
            >
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
        )}

        {!showCompletionBurst && !showSessionControls && !showFixedPrepReady ? (
          isPrepActive ? (
            <p className="focus-screen__meta">{prepLabel}</p>
          ) : (
            <p className="focus-screen__meta">Можно взять время на подготовку или начать сразу</p>
          )
        ) : null}

        {showFixedPrepReady ? (
          <>
            <p className="focus-screen__meta focus-screen__meta--ready">
              Нажмите «Начать» — вам дадут {formatPrepDuration(fixedPrepSeconds)} на принятие
              позиции, затем начнётся планка на {formatCountdown(sessionTotalSeconds)}.
            </p>
            <div className="focus-screen__actions">
              <button
                type="button"
                className="focus-screen__btn focus-screen__btn--primary"
                onClick={() => startPrep(fixedPrepSeconds)}
              >
                Начать
              </button>
            </div>
          </>
        ) : null}

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

        {showSessionControls && sessionActive && !showCompletionBurst ? (
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
