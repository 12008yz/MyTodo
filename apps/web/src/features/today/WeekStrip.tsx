import type { DayColorValue } from "@mytodo/shared";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

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
  today: string;
};

export function WeekStrip({ days, today }: WeekStripProps) {
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
