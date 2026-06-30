import { useEffect, useState } from "react";
import { HARSHNESS_OPTIONS } from "../../features/onboarding/constants";
import { ClientApiError } from "../../lib/api";
import { ProfileModal } from "./ProfileModal";

type EditHarshnessModalProps = {
  open: boolean;
  level: number;
  onClose: () => void;
  onSave: (harshness_level: 1 | 2 | 3) => Promise<void>;
};

export function EditHarshnessModal({ open, level, onClose, onSave }: EditHarshnessModalProps) {
  const [selected, setSelected] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const normalized = level >= 1 && level <= 3 ? (level as 1 | 2 | 3) : 1;
      setSelected(normalized);
      setError(null);
    }
  }, [open, level]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(selected);
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
      title="Жёсткость наставника"
      art="forge"
      onClose={onClose}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
      wide
    >
      <p className="profile-modal__hint">
        Влияет на тон подсказок и сообщений коуча. Можно сменить в любой момент.
      </p>
      <div className="profile-modal__choices" role="radiogroup" aria-label="Жёсткость наставника">
        {HARSHNESS_OPTIONS.map((option) => (
          <button
            key={option.level}
            type="button"
            role="radio"
            aria-checked={selected === option.level}
            className={[
              "profile-modal__choice",
              selected === option.level ? "profile-modal__choice--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setSelected(option.level)}
          >
            <p className="profile-modal__choice-title">
              {option.emoji} {option.title}
            </p>
            <p className="profile-modal__choice-quote">{option.quote}</p>
          </button>
        ))}
      </div>
    </ProfileModal>
  );
}
