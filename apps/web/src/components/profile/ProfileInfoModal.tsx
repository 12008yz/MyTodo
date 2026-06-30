import { ProfileModal } from "./ProfileModal";
import type { ProfileModalArtVariant } from "./profileModalArt";

type ProfileInfoModalProps = {
  open: boolean;
  title: string;
  art?: ProfileModalArtVariant;
  onClose: () => void;
  children: string;
};

export function ProfileInfoModal({
  open,
  title,
  art = "chapter",
  onClose,
  children,
}: ProfileInfoModalProps) {
  return (
    <ProfileModal open={open} title={title} art={art} onClose={onClose} hideActions>
      <p className="profile-modal__text">{children}</p>
      <button type="button" className="profile-modal__close-btn" onClick={onClose}>
        Понятно
      </button>
    </ProfileModal>
  );
}
