import type { DoomScrollPlatform } from "@mytodo/shared";
import { DOOM_SCROLL_PLATFORM_LABELS } from "@mytodo/shared";

type DoomScrollAppPickerProps = {
  isOpen: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSelect: (platform: DoomScrollPlatform) => void;
};

const PLATFORMS: DoomScrollPlatform[] = [
  "tiktok",
  "youtube_shorts",
  "instagram_reels",
  "youtube",
  "other",
];

export function DoomScrollAppPicker({
  isOpen,
  isSubmitting = false,
  onCancel,
  onSelect,
}: DoomScrollAppPickerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="home__value-prompt" role="presentation" onClick={onCancel}>
      <div
        className="home__value-prompt-panel home__doom-scroll-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doom-scroll-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="doom-scroll-picker-title" className="home__value-prompt-title">
          Куда идёшь?
        </h3>
        <p className="home__doom-scroll-picker-hint">
          Выбери приложение — в конце сессии пришлём напоминание закрыть именно его.
        </p>
        <div className="home__doom-scroll-picker-grid">
          {PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              className="home__doom-scroll-picker-btn"
              disabled={isSubmitting}
              onClick={() => onSelect(platform)}
            >
              {DOOM_SCROLL_PLATFORM_LABELS[platform]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="home__value-prompt-btn home__value-prompt-btn--ghost home__doom-scroll-picker-cancel"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
