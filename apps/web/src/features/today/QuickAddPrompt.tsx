import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import type { HabitCategoryKey, HabitSide, HabitTemplateId, HabitUnit } from "@mytodo/shared";
import { ProfileModal } from "../../components/profile/ProfileModal";
import { formatUnit } from "./format";

type QuickAddPromptProps = {
  isOpen: boolean;
  habitId: string;
  habitName: string;
  unit: HabitUnit;
  side: HabitSide;
  templateId?: HabitTemplateId | null;
  categoryKey?: HabitCategoryKey | null;
  icon?: string | null;
  chips?: number[];
  hint?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onAdd: (amount: number) => void;
};

export function QuickAddPrompt({
  isOpen,
  habitId,
  habitName,
  unit,
  side,
  templateId,
  categoryKey,
  icon,
  chips = [],
  hint = "Добавить сверх плана",
  isSubmitting = false,
  onCancel,
  onAdd,
}: QuickAddPromptProps) {
  const [value, setValue] = useState("");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    onAdd(parsed);
  };

  return (
    <ProfileModal
      open={isOpen}
      title={habitName}
      onClose={onCancel}
      isSaving={isSubmitting}
      hideActions
      homeHeader={{
        habitId,
        habitName,
        side,
        templateId,
        categoryKey,
        icon,
      }}
    >
      <form onSubmit={handleSubmit}>
        <p className="profile-modal__hint">{hint}</p>

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

        <label className="profile-modal__field" htmlFor={inputId}>
          <span className="profile-modal__label">Или введите своё число</span>
          <input
            ref={inputRef}
            id={inputId}
            className="profile-modal__input"
            type="number"
            min={1}
            step={unit === "minutes" ? 1 : "any"}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={`0 ${formatUnit(unit)}`}
          />
        </label>

        <div className="profile-modal__actions">
          <button
            type="button"
            className="profile-modal__btn profile-modal__btn--ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="profile-modal__btn profile-modal__btn--primary"
            disabled={isSubmitting || !value}
          >
            Добавить
          </button>
        </div>
      </form>
    </ProfileModal>
  );
}
