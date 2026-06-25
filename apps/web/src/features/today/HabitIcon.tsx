import type { HabitSide } from "@mytodo/shared";
import { resolveHabitIcon, type HabitIconSource } from "@mytodo/shared";

function isHabitIconImage(icon: string): boolean {
  return icon.startsWith("/") || icon.startsWith("http://") || icon.startsWith("https://");
}

type HabitIconProps = HabitIconSource & {
  side: HabitSide;
};

export function HabitIcon({
  icon,
  side,
  template_id,
  category_key,
  name,
}: HabitIconProps) {
  const resolved = resolveHabitIcon({ icon, template_id, category_key, name, side });
  const fallback = side === "light" ? "☀️" : "🌑";
  const value = resolved?.trim() || fallback;

  if (isHabitIconImage(value)) {
    return <img className="home__task-icon" src={value} alt="" />;
  }

  return (
    <span className="home__task-icon home__task-icon--emoji" aria-hidden="true">
      {value}
    </span>
  );
}
