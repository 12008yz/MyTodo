import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ProfileModalYinYangWaves } from "./ProfileModalYinYangWaves";
import type { ProfileModalArtVariant } from "./profileModalArt";
import "./ProfileModal.css";

function getHomePortalRoot(): HTMLElement {
  return document.querySelector(".home") ?? document.body;
}

/** Must cover overlay + panel CSS transitions (see ProfileModal.css). */
const CLOSE_MS = 520;
const OPEN_ENTER_MS = 40;

type ProfileModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave?: () => void | Promise<void>;
  saveLabel?: string;
  isSaving?: boolean;
  error?: string | null;
  children: ReactNode;
  wide?: boolean;
  hideActions?: boolean;
  art?: ProfileModalArtVariant;
};

export function ProfileModal({
  open,
  title,
  onClose,
  onSave,
  saveLabel = "Сохранить",
  isSaving = false,
  error = null,
  children,
  wide = false,
  hideActions = false,
  art = "yin-yang",
}: ProfileModalProps) {
  const titleId = useId();
  const timerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setPortalRoot(getHomePortalRoot());
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();

    if (open) {
      setMounted(true);
      setVisible(false);
      timerRef.current = window.setTimeout(() => {
        setVisible(true);
        timerRef.current = null;
      }, OPEN_ENTER_MS);
      return clearTimer;
    }

    setVisible(false);
    timerRef.current = window.setTimeout(() => {
      setMounted(false);
      timerRef.current = null;
    }, CLOSE_MS);

    return clearTimer;
  }, [open, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const requestClose = useCallback(() => {
    if (isSaving) return;
    onClose();
  }, [isSaving, onClose]);

  useEffect(() => {
    if (!mounted) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, requestClose]);

  if (!mounted || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className={["profile-modal", visible ? "profile-modal--visible" : ""].filter(Boolean).join(" ")}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={[
          "profile-modal__panel",
          wide ? "profile-modal__panel--wide" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <ProfileModalYinYangWaves variant={art} />

        <div className="profile-modal__content">
          <h2 id={titleId} className="profile-modal__title">
            {title}
          </h2>

          <div className="profile-modal__body">{children}</div>

          {error ? <p className="profile-modal__error">{error}</p> : null}

          {hideActions ? null : (
            <div className="profile-modal__actions">
              <button
                type="button"
                className="profile-modal__btn profile-modal__btn--ghost"
                onClick={requestClose}
                disabled={isSaving}
              >
                Отмена
              </button>
              <button
                type="button"
                className="profile-modal__btn profile-modal__btn--primary"
                disabled={isSaving || !onSave}
                onClick={() => void onSave?.()}
              >
                {isSaving ? "Сохраняем…" : saveLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
