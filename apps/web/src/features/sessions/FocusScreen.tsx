import "./FocusScreen.css";

type FocusScreenProps = {
  isOpen: boolean;
  habitName: string;
  plannedMin: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  isPaused: boolean;
  canStopEarly: boolean;
  onTogglePause: () => void;
  onStopEarly: () => void;
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
  canStopEarly,
  onTogglePause,
  onStopEarly,
}: FocusScreenProps) {
  if (!isOpen) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round(plannedMin * 60));
  const safeRemaining = Math.max(0, remainingSeconds);
  const progress = 1 - safeRemaining / totalSeconds;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="focus-screen" role="dialog" aria-modal="true" aria-labelledby="focus-screen-title">
      <div className="focus-screen__panel">
        <p className="focus-screen__eyebrow">Сессия фокуса</p>
        <p id="focus-screen-title" className="focus-screen__habit">
          {habitName}
        </p>

        <div
          className={[
            "focus-screen__ring-wrap",
            isPaused ? "focus-screen__ring-wrap--paused" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <svg className="focus-screen__ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="focus-screen__ring-track" cx="100" cy="100" r={radius} />
            <circle
              className="focus-screen__ring-progress"
              cx="100"
              cy="100"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <p className="focus-screen__timer" aria-live="polite">
            {formatCountdown(safeRemaining)}
          </p>
        </div>

        <p className="focus-screen__meta">
          {isPaused ? "На паузе" : "Осталось"} · прошло {formatCountdown(elapsedSeconds)}
        </p>

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

        {!canStopEarly ? (
          <p className="focus-screen__hint">Таймер идёт — подождите несколько секунд</p>
        ) : null}
      </div>
    </div>
  );
}
