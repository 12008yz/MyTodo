import { useEffect, useState } from "react";
import { ClientApiError } from "../../lib/api";
import { ProfileModal } from "./ProfileModal";

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
    <ProfileModal
      open={open}
      title="Изменить имя"
      art="spark"
      onClose={onClose}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
    >
      <p className="profile-modal__hint">Как к тебе обращаться в приложении и уведомлениях.</p>
      <input
        type="text"
        className="profile-modal__input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={255}
        autoFocus
        aria-label="Имя"
      />
    </ProfileModal>
  );
}
