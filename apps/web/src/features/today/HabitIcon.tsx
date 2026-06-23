import type { TodaySide } from "./useTodayData";

function isHabitIconImage(icon: string): boolean {
  return icon.startsWith("/") || icon.startsWith("http://") || icon.startsWith("https://");
}

type HabitIconProps = {
  icon: string | null | undefined;
  side: TodaySide;
};

export function HabitIcon({ icon, side }: HabitIconProps) {
  const fallback = side === "light" ? "☀️" : "🌑";
  const value = icon ?? fallback;

  if (isHabitIconImage(value)) {
    return <img className="home__task-icon" src={value} alt="" />;
  }

  return (
    <span className="home__task-icon home__task-icon--emoji" aria-hidden="true">
      {value}
    </span>
  );
}
