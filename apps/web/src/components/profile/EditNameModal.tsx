import { useEffect, useState } from "react";
import { ClientApiError } from "../../lib/api";
import "./EditNameModal.css";

type EditNameModalProps = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
};

export function EditNameModal({ open, initialName, onClose, onSave }: EditNameModalProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
    }
  }, [open, initialName]);

  if (!open) {
    return null;
  }

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введи имя");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
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
    <div className="edit-name-modal" role="presentation" onClick={onClose}>
      <div
        className="edit-name-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-name-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="edit-name-title" className="edit-name-modal__title">
          Изменить имя
        </h2>
        <div className="edit-name-modal__divider" />
        <input
          type="text"
          className="edit-name-modal__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
          autoFocus
        />
        {error ? <p className="edit-name-modal__error">{error}</p> : null}
        <div className="edit-name-modal__actions">
          <button type="button" className="edit-name-modal__btn edit-name-modal__btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="edit-name-modal__btn edit-name-modal__btn--primary"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
