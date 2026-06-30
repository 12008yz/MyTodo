import { useEffect, useState } from "react";
import { ClientApiError } from "../../lib/api";
import { ProfileModal } from "./ProfileModal";

type EditPomodoroModalProps = {
  open: boolean;
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  onClose: () => void;
  onSave: (data: {
    pomodoro_work_min: number;
    pomodoro_break_min: number;
    pomodoro_long_break_min: number;
  }) => Promise<void>;
};

function parseMinutes(value: string, min: number, max: number): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

export function EditPomodoroModal({
  open,
  workMin,
  breakMin,
  longBreakMin,
  onClose,
  onSave,
}: EditPomodoroModalProps) {
  const [work, setWork] = useState(String(workMin));
  const [breakValue, setBreakValue] = useState(String(breakMin));
  const [longBreak, setLongBreak] = useState(String(longBreakMin));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setWork(String(workMin));
      setBreakValue(String(breakMin));
      setLongBreak(String(longBreakMin));
      setError(null);
    }
  }, [open, workMin, breakMin, longBreakMin]);

  const handleSave = async () => {
    const workMinutes = parseMinutes(work, 1, 120);
    const breakMinutes = parseMinutes(breakValue, 1, 60);
    const longBreakMinutes = parseMinutes(longBreak, 1, 60);

    if (workMinutes === null || breakMinutes === null || longBreakMinutes === null) {
      setError("Проверь значения: работа 1–120 мин, перерывы 1–60 мин");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        pomodoro_work_min: workMinutes,
        pomodoro_break_min: breakMinutes,
        pomodoro_long_break_min: longBreakMinutes,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось сохранить",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProfileModal
      open={open}
      title="Помодоро"
      art="pulse"
      onClose={onClose}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
    >
      <p className="profile-modal__hint">
        Длительность рабочих интервалов и перерывов для таймера на главной.
      </p>
      <label className="profile-modal__field">
        <span className="profile-modal__label">Работа (мин)</span>
        <input
          type="number"
          className="profile-modal__input"
          min={1}
          max={120}
          inputMode="numeric"
          value={work}
          onChange={(event) => setWork(event.target.value)}
        />
      </label>
      <label className="profile-modal__field">
        <span className="profile-modal__label">Короткий перерыв (мин)</span>
        <input
          type="number"
          className="profile-modal__input"
          min={1}
          max={60}
          inputMode="numeric"
          value={breakValue}
          onChange={(event) => setBreakValue(event.target.value)}
        />
      </label>
      <label className="profile-modal__field">
        <span className="profile-modal__label">Длинный перерыв (мин)</span>
        <input
          type="number"
          className="profile-modal__input"
          min={1}
          max={60}
          inputMode="numeric"
          value={longBreak}
          onChange={(event) => setLongBreak(event.target.value)}
        />
      </label>
    </ProfileModal>
  );
}
