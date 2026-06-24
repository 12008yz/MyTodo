import "./FocusScreen.css";

type FocusScreenProps = {
  isOpen: boolean;
  habitName: string;
  remainingSeconds: number;
  isPaused: boolean;
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
  remainingSeconds,
  isPaused,
  onTogglePause,
  onStopEarly,
}: FocusScreenProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="focus-screen" role="dialog" aria-modal="true" aria-labelledby="focus-screen-title">
      <div className="focus-screen__panel">
        <p id="focus-screen-title" className="focus-screen__title">
          Фокус на задаче
        </p>
        <p className="focus-screen__habit">{habitName}</p>
        <p className="focus-screen__timer" aria-live="polite">
          {formatCountdown(Math.max(0, remainingSeconds))}
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
            onClick={onStopEarly}
          >
            Закончил раньше
          </button>
        </div>
      </div>
    </div>
  );
}
