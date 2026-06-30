import { useEffect, useState } from "react";
import { TimeInput24 } from "../TimeInput24/TimeInput24";
import { ClientApiError } from "../../lib/api";
import { ProfileModal } from "./ProfileModal";

type EditScheduleModalProps = {
  open: boolean;
  wakeTime: string | null;
  sleepTime: string | null;
  onClose: () => void;
  onSave: (data: { wake_time: string; sleep_time: string }) => Promise<void>;
};

const DEFAULT_WAKE = "07:00";
const DEFAULT_SLEEP = "23:00";

export function EditScheduleModal({
  open,
  wakeTime,
  sleepTime,
  onClose,
  onSave,
}: EditScheduleModalProps) {
  const [wake, setWake] = useState(DEFAULT_WAKE);
  const [sleep, setSleep] = useState(DEFAULT_SLEEP);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setWake(wakeTime?.slice(0, 5) ?? DEFAULT_WAKE);
      setSleep(sleepTime?.slice(0, 5) ?? DEFAULT_SLEEP);
      setError(null);
    }
  }, [open, wakeTime, sleepTime]);

  const handleSave = async () => {
    if (wake === sleep) {
      setError("Время подъёма и сна не должны совпадать");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({ wake_time: wake, sleep_time: sleep });
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
      title="Режим дня"
      art="horizon"
      onClose={onClose}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
    >
      <p className="profile-modal__hint">
        Используем для утренних привычек и закрытия дня. Можно изменить в любой момент.
      </p>
      <div className="profile-modal__time-fields">
        <label className="profile-modal__field">
          <span className="profile-modal__label">Подъём</span>
          <TimeInput24 id="profile-wake" value={wake} variant="light" onChange={setWake} />
        </label>
        <label className="profile-modal__field">
          <span className="profile-modal__label">Сон</span>
          <TimeInput24 id="profile-sleep" value={sleep} variant="light" onChange={setSleep} />
        </label>
      </div>
    </ProfileModal>
  );
}
