import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CustomHabitUnit } from "@mytodo/shared";
import { CUSTOM_HABIT_UNITS } from "@mytodo/shared";
import { useHabitSide } from "../../features/shell/SideContext";
import { createHabit, ClientApiError } from "../../lib/api";
import "./AddHabitModal.css";

const UNIT_LABELS: Record<CustomHabitUnit, string> = {
  minutes: "Минуты",
  pages: "Страницы",
  reps: "Повторения",
  lessons: "Уроки",
};

type AddHabitModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AddHabitModal({ open, onClose }: AddHabitModalProps) {
  const queryClient = useQueryClient();
  const { setSide } = useHabitSide();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<CustomHabitUnit>("minutes");
  const [baseline, setBaseline] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) {
    return null;
  }

  const reset = () => {
    setName("");
    setUnit("minutes");
    setBaseline("0");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Укажи название занятия");
      return;
    }

    const baselineValue = Number(baseline.replace(",", "."));
    if (!Number.isFinite(baselineValue) || baselineValue < 0) {
      setError("Укажи корректный текущий уровень");
      return;
    }

    setIsSubmitting(true);
    try {
      await createHabit({
        name: trimmed,
        unit,
        baseline_value: baselineValue,
      });
      setSide("light");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["today"] }),
        queryClient.invalidateQueries({ queryKey: ["stats-week"] }),
        queryClient.invalidateQueries({ queryKey: ["stats-calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["stats-month"] }),
        queryClient.invalidateQueries({ queryKey: ["stats-progress"] }),
        queryClient.invalidateQueries({ queryKey: ["time-distribution"] }),
      ]);
      handleClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось добавить привычку",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-habit-modal" role="presentation" onClick={handleClose}>
      <div
        className="add-habit-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-habit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="add-habit-title" className="add-habit-modal__title">
          + Своё занятие
        </h2>
        <p className="add-habit-modal__hint">
          Добавь полезную привычку на светлую сторону: программирование, рисование, музыка…
        </p>

        <form className="add-habit-modal__form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="add-habit-modal__field">
            <span className="add-habit-modal__label">Название</span>
            <input
              type="text"
              className="add-habit-modal__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, Blender 3D"
              maxLength={255}
              autoFocus
            />
          </label>

          <label className="add-habit-modal__field">
            <span className="add-habit-modal__label">Единица</span>
            <select
              className="add-habit-modal__input"
              value={unit}
              onChange={(event) => setUnit(event.target.value as CustomHabitUnit)}
            >
              {CUSTOM_HABIT_UNITS.map((value) => (
                <option key={value} value={value}>
                  {UNIT_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="add-habit-modal__field">
            <span className="add-habit-modal__label">Сколько сейчас в день?</span>
            <input
              type="number"
              className="add-habit-modal__input"
              min={0}
              value={baseline}
              onChange={(event) => setBaseline(event.target.value)}
            />
          </label>

          {error ? <p className="add-habit-modal__error">{error}</p> : null}

          <div className="add-habit-modal__actions">
            <button type="button" className="add-habit-modal__btn add-habit-modal__btn--ghost" onClick={handleClose}>
              Отмена
            </button>
            <button type="submit" className="add-habit-modal__btn add-habit-modal__btn--primary" disabled={isSubmitting}>
              {isSubmitting ? "Добавляем…" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
