import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HabitUnit } from "@mytodo/shared";
import { formatUnit } from "../today/format";

type ValuePromptProps = {
  isOpen: boolean;
  habitName: string;
  unit: HabitUnit;
  expectedYield?: number;
  showExpectedHint?: boolean;
  inputLabel?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (value: number) => void;
};

function getHomePortalRoot(): HTMLElement {
  return document.querySelector(".home") ?? document.body;
}

export function ValuePrompt({
  isOpen,
  habitName,
  unit,
  expectedYield = 0,
  showExpectedHint = true,
  inputLabel = "Сколько сделал?",
  isSubmitting = false,
  onCancel,
  onSubmit,
}: ValuePromptProps) {
  const [value, setValue] = useState(String(expectedYield));
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    setPortalRoot(getHomePortalRoot());
  }, []);

  useEffect(() => {
    if (isOpen) {
      setValue(String(expectedYield));
    }
  }, [expectedYield, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const home = document.querySelector(".home");
    if (home instanceof HTMLElement) {
      home.classList.add("home--scroll-locked");
    }

    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(id);
      if (home instanceof HTMLElement) {
        home.classList.remove("home--scroll-locked");
      }
    };
  }, [isOpen]);

  if (!isOpen || !portalRoot) {
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

  return createPortal(
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
        {showExpectedHint ? (
          <p className="home__value-prompt-hint">
            Ожидаемо: {expectedYield} {formatUnit(unit)}
          </p>
        ) : null}
        <label className="home__value-prompt-label" htmlFor="value-prompt-input">
          {inputLabel}
        </label>
        <input
          ref={inputRef}
          id="value-prompt-input"
          className="home__value-prompt-input"
          type="number"
          inputMode="decimal"
          min={0}
          step={unit === "minutes" ? 1 : "any"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
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
    </div>,
    portalRoot,
  );
}
