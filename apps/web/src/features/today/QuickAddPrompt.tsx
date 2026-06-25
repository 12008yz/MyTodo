import { type FormEvent, useEffect, useState } from "react";
import type { HabitUnit } from "@mytodo/shared";
import { formatUnit } from "./format";

type QuickAddPromptProps = {
  isOpen: boolean;
  habitName: string;
  unit: HabitUnit;
  chips?: number[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onAdd: (amount: number) => void;
};

export function QuickAddPrompt({
  isOpen,
  habitName,
  unit,
  chips = [],
  isSubmitting = false,
  onCancel,
  onAdd,
}: QuickAddPromptProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      setValue("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    onAdd(parsed);
  };

  return (
    <div className="home__value-prompt" role="presentation" onClick={onCancel}>
      <form
        className="home__value-prompt-panel home__quick-add-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 id="quick-add-title" className="home__value-prompt-title">
          {habitName}
        </h3>
        <p className="home__value-prompt-hint">Добавить сверх плана</p>

        {chips.length > 0 ? (
          <div className="home__quick-add-chips">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className="home__quick-add-chip"
                disabled={isSubmitting}
                onClick={() => onAdd(chip)}
              >
                +{chip} {formatUnit(unit)}
              </button>
            ))}
          </div>
        ) : null}

        <label className="home__value-prompt-label" htmlFor="quick-add-input">
          Или введите своё число
        </label>
        <input
          id="quick-add-input"
          className="home__value-prompt-input"
          type="number"
          min={1}
          step={unit === "minutes" ? 1 : "any"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={`0 ${formatUnit(unit)}`}
          autoFocus
        />
        <div className="home__value-prompt-actions">
          <button
            type="button"
            className="home__value-prompt-btn home__value-prompt-btn--ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="home__value-prompt-btn home__value-prompt-btn--primary"
            disabled={isSubmitting || !value}
          >
            Добавить
          </button>
        </div>
      </form>
    </div>
  );
}
