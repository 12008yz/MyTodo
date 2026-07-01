import type { HabitCategoryKey, HabitSide, HabitTemplateId } from "@mytodo/shared";
import { resolveHabitIcon } from "@mytodo/shared";
import {
  getHomeModalHeaderArt,
  getHomeModalHeaderGlyphs,
  resolveHomeModalHeaderArtKey,
} from "./homeModalHeaderArt";
import "./HomeModalHeader.css";

type HomeModalHeaderProps = {
  habitId: string;
  templateId?: HabitTemplateId | null;
  categoryKey?: HabitCategoryKey | null;
  icon?: string | null;
  habitName: string;
  side: HabitSide;
};

function isHabitIconImage(icon: string): boolean {
  return icon.startsWith("/") || icon.startsWith("http://") || icon.startsWith("https://");
}

export function HomeModalHeader({
  habitId,
  templateId,
  categoryKey,
  icon,
  habitName,
  side,
}: HomeModalHeaderProps) {
  const artKey = resolveHomeModalHeaderArtKey({
    templateId,
    categoryKey,
    habitId,
  });
  const art = getHomeModalHeaderArt(artKey);
  const glyphs = getHomeModalHeaderGlyphs(artKey);
  const resolvedIcon =
    resolveHabitIcon({
      icon,
      template_id: templateId,
      category_key: categoryKey,
      name: habitName,
      side,
    }) ?? (side === "light" ? "☀️" : "🌑");
  const iconIsImage = isHabitIconImage(resolvedIcon);

  return (
    <div
      className={[
        "home-modal-header",
        `home-modal-header--${art.theme}`,
        `home-modal-header--hero-${art.heroPlacement}`,
      ].join(" ")}
      aria-hidden="true"
    >
      <div className="home-modal-header__mesh" />
      <div className="home-modal-header__hero">
        {iconIsImage ? (
          <img className="home-modal-header__hero-image" src={resolvedIcon} alt="" />
        ) : (
          <span className="home-modal-header__hero-emoji">{resolvedIcon}</span>
        )}
      </div>
      {glyphs.map((glyph) => (
        <div
          key={glyph.id}
          className={[
            "home-modal-header__glyph",
            `home-modal-header__glyph--${glyph.layout}`,
          ].join(" ")}
        >
          {glyph.segments.map((segment, index) => (
            <span
              key={`${glyph.id}-${index}`}
              className={[
                "home-modal-header__segment",
                `home-modal-header__segment--${segment.kind}`,
              ].join(" ")}
            >
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
