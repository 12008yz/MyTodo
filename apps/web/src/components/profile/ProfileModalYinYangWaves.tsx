import { useId } from "react";
import {
  PROFILE_MODAL_ART,
  type ProfileModalArtVariant,
} from "./profileModalArt";
import "./ProfileModalWaveVariants.css";

type ProfileModalYinYangWavesProps = {
  variant?: ProfileModalArtVariant;
};

export function ProfileModalYinYangWaves({ variant = "yin-yang" }: ProfileModalYinYangWavesProps) {
  const uid = useId().replace(/:/g, "");
  const lightId = `profile-modal-light-${uid}`;
  const darkId = `profile-modal-dark-${uid}`;
  const glowLightId = `profile-modal-glow-light-${uid}`;
  const glowDarkId = `profile-modal-glow-dark-${uid}`;

  const art = PROFILE_MODAL_ART[variant];
  const [accentLight, accentDark] = art.accents;

  return (
    <div
      className={[
        "profile-modal__waves",
        variant === "yin-yang" ? "" : `profile-modal__waves--${variant}`,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <svg
        className="profile-modal__waves-svg"
        viewBox="0 0 360 80"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={lightId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--pm-light-0)" />
            <stop offset="55%" stopColor="var(--pm-light-1)" />
            <stop offset="100%" stopColor="var(--pm-light-2)" />
          </linearGradient>
          <linearGradient id={darkId} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--pm-dark-0)" />
            <stop offset="45%" stopColor="var(--pm-dark-1)" />
            <stop offset="100%" stopColor="var(--pm-dark-2)" />
          </linearGradient>
          <radialGradient id={glowLightId} cx="22%" cy="28%" r="55%">
            <stop offset="0%" stopColor="var(--pm-glow-light)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id={glowDarkId} cx="78%" cy="72%" r="50%">
            <stop offset="0%" stopColor="var(--pm-glow-dark)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        <path
          className="profile-modal__wave profile-modal__wave--dark"
          fill={`url(#${darkId})`}
          d={art.paths.dark}
        />
        <path
          className="profile-modal__wave profile-modal__wave--light"
          fill={`url(#${lightId})`}
          d={art.paths.light}
        />
        <ellipse
          cx={art.glowLight.cx}
          cy={art.glowLight.cy}
          rx={art.glowLight.rx}
          ry={art.glowLight.ry}
          fill={`url(#${glowLightId})`}
        />
        <ellipse
          cx={art.glowDark.cx}
          cy={art.glowDark.cy}
          rx={art.glowDark.rx}
          ry={art.glowDark.ry}
          fill={`url(#${glowDarkId})`}
        />

        <circle cx={accentLight.cx} cy={accentLight.cy} r={accentLight.r} fill={accentLight.fill} />
        <circle cx={accentDark.cx} cy={accentDark.cy} r={accentDark.r} fill={accentDark.fill} />
      </svg>
    </div>
  );
}
