import { type FormEvent, useEffect, useState } from "react";
import type { HabitUnit } from "@mytodo/shared";
import { formatUnit } from "../today/format";

type ValuePromptProps = {
  isOpen: boolean;
  habitName: string;
  unit: HabitUnit;
  expectedYield: number;
  inputLabel?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (value: number) => void;
};

export function ValuePrompt({
  isOpen,
  habitName,
  unit,
  expectedYield,
  inputLabel = "Сколько сделал?",
  isSubmitting = false,
  onCancel,
  onSubmit,
}: ValuePromptProps) {
  const [value, setValue] = useState(String(expectedYield));

  useEffect(() => {
    if (isOpen) {
      setValue(String(expectedYield));
    }
  }, [expectedYield, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }
    onSubmit(parsed);
  };

  return (
    <div className="home__value-prompt" role="presentation" onClick={onCancel}>
      <form
        className="home__value-prompt-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="value-prompt-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 id="value-prompt-title" className="home__value-prompt-title">
          {habitName}
        </h3>
        <p className="home__value-prompt-hint">
          Ожидаемо: {expectedYield} {formatUnit(unit)}
        </p>
        <label className="home__value-prompt-label" htmlFor="value-prompt-input">
          {inputLabel}
        </label>
        <input
          id="value-prompt-input"
          className="home__value-prompt-input"
          type="number"
          min={0}
          step={unit === "minutes" ? 1 : "any"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
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
            disabled={isSubmitting}
          >
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}
