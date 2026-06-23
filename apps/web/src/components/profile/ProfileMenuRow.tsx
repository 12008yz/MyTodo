import type { ReactNode } from "react";
import { ChevronRightIcon } from "./ProfileIcons";

type ProfileMenuRowProps = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
};

export function ProfileMenuRow({
  icon,
  label,
  onClick,
  hint,
  danger = false,
  disabled = false,
  showChevron = true,
}: ProfileMenuRowProps) {
  return (
    <button
      type="button"
      className={[
        "profile-menu-row",
        danger ? "profile-menu-row--danger" : "",
        disabled ? "profile-menu-row--disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="profile-menu-row__icon">{icon}</span>
      <span className="profile-menu-row__body">
        <span className="profile-menu-row__label">{label}</span>
        {hint ? <span className="profile-menu-row__hint">{hint}</span> : null}
      </span>
      {showChevron && !danger ? (
        <ChevronRightIcon className="profile-menu-row__chevron" />
      ) : null}
    </button>
  );
}
