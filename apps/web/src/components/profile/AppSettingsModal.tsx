import { useEffect, useState } from "react";
import { isPushSupported, requestPushSubscription } from "../../lib/push";
import { ProfileModal } from "./ProfileModal";

type AppSettingsModalProps = {
  open: boolean;
  pomodoroHint: string;
  onClose: () => void;
  onOpenPomodoro: () => void;
};

function getNotificationStatusLabel(): string {
  if (!isPushSupported()) {
    return "Не поддерживается в этом браузере";
  }

  if (typeof Notification === "undefined") {
    return "Недоступно";
  }

  if (Notification.permission === "granted") {
    return "Включены";
  }

  if (Notification.permission === "denied") {
    return "Заблокированы в браузере";
  }

  return "Не включены";
}

export function AppSettingsModal({
  open,
  pomodoroHint,
  onClose,
  onOpenPomodoro,
}: AppSettingsModalProps) {
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushPending, setPushPending] = useState(false);

  useEffect(() => {
    if (open) {
      setPushMessage(null);
      setPushPending(false);
    }
  }, [open]);

  const handleEnablePush = async () => {
    setPushPending(true);
    setPushMessage(null);
    try {
      const enabled = await requestPushSubscription();
      if (enabled) {
        setPushMessage("Уведомления включены");
      } else if (!isPushSupported()) {
        setPushMessage("Браузер не поддерживает push-уведомления");
      } else if (Notification.permission === "denied") {
        setPushMessage("Разреши уведомления в настройках браузера");
      } else {
        setPushMessage("Не удалось подключить уведомления");
      }
    } finally {
      setPushPending(false);
    }
  };

  return (
    <ProfileModal open={open} title="Настройки приложения" art="signal" onClose={onClose} hideActions>
      <p className="profile-modal__hint">Помодоро и push-уведомления для напоминаний о привычках.</p>

      <button
        type="button"
        className="profile-modal__action-row"
        onClick={() => {
          onClose();
          onOpenPomodoro();
        }}
      >
        <span>
          <span className="profile-modal__action-label">Помодоро</span>
          <span className="profile-modal__action-hint">{pomodoroHint}</span>
        </span>
        <span aria-hidden="true">›</span>
      </button>

      <button
        type="button"
        className="profile-modal__action-row"
        disabled={pushPending}
        onClick={() => void handleEnablePush()}
      >
        <span>
          <span className="profile-modal__action-label">Уведомления</span>
          <span className="profile-modal__action-hint">{getNotificationStatusLabel()}</span>
        </span>
        <span aria-hidden="true">{pushPending ? "…" : "›"}</span>
      </button>

      {pushMessage ? <p className="profile-modal__hint">{pushMessage}</p> : null}

      <button type="button" className="profile-modal__close-btn" onClick={onClose}>
        Готово
      </button>
    </ProfileModal>
  );
}
