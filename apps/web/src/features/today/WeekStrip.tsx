import type { DayColorValue } from "@mytodo/shared";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function getPlaceholderWeekDays(): Array<{ date: string; color: DayColorValue }> {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}`, color: "pending" as const };
  });
}

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const COLOR_CLASS: Record<DayColorValue, string> = {
  success: "home__week-day-dot--success",
  pending: "home__week-day-dot--pending",
  fail: "home__week-day-dot--fail",
  skipped: "home__week-day-dot--skipped",
};

type WeekStripProps = {
  days: Array<{
    date: string;
    color: DayColorValue;
  }>;
  today?: string;
};

export function WeekStrip({ days, today = todayIsoDate() }: WeekStripProps) {
  return (
    <div className="home__week-strip" aria-label="Неделя">
      {days.map((day, index) => {
        const isToday = day.date === today;
        return (
          <div
            key={day.date}
            className={["home__week-day", isToday ? "home__week-day--active" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="home__week-day-label">{DAY_LABELS[index]}</span>
            <span
              className={["home__week-day-dot", COLOR_CLASS[day.color]].join(" ")}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </div>
  );
}
