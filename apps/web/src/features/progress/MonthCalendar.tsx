import type { CSSProperties } from "react";
import type { DayColorValue } from "@mytodo/shared";

const COLOR_CLASS: Record<DayColorValue, string> = {
  success: "progress__cal-day--success",
  pending: "progress__cal-day--pending",
  fail: "progress__cal-day--fail",
  skipped: "progress__cal-day--skipped",
};

const WEEKDAY_HEADERS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const DAYS_PER_WEEK = 7;

type MonthCalendarProps = {
  month: string;
  days: Array<{ date: string; color: DayColorValue }>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  todayDate?: string | null;
};

function getMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const label = new Date(year!, monthNum! - 1, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildCalendarCells(month: string, days: MonthCalendarProps["days"]) {
  const [year, monthNum] = month.split("-").map(Number);
  const firstWeekday = new Date(year!, monthNum! - 1, 1).getDay();
  const mondayOffset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const colorByDate = new Map(days.map((day) => [day.date, day.color]));

  const cells: Array<{ date: string | null; color?: DayColorValue }> = [];
  for (let index = 0; index < mondayOffset; index += 1) {
    cells.push({ date: null });
  }

  for (const day of days) {
    cells.push({ date: day.date, color: colorByDate.get(day.date) ?? "pending" });
  }

  while (cells.length % DAYS_PER_WEEK !== 0) {
    cells.push({ date: null });
  }

  return cells;
}

export function countCalendarGridCells(
  month: string,
  days: Array<{ date: string; color: DayColorValue }>,
): number {
  return buildCalendarCells(month, days).length;
}

export function countCalendarWeekRows(
  month: string,
  days: Array<{ date: string; color: DayColorValue }>,
): number {
  return countCalendarGridCells(month, days) / DAYS_PER_WEEK;
}

export function MonthCalendar({
  month,
  days,
  selectedDate,
  onSelectDate,
  todayDate,
}: MonthCalendarProps) {
  const cells = buildCalendarCells(month, days);
  const weekRows = cells.length / DAYS_PER_WEEK;

  return (
    <div className="progress__calendar" aria-label={`Календарь: ${getMonthLabel(month)}`}>
      <div className="progress__cal-weekdays">
        {WEEKDAY_HEADERS.map((label) => (
          <span key={label} className="progress__cal-weekday">
            {label}
          </span>
        ))}
      </div>
      <div
        className="progress__cal-grid"
        style={{ "--cal-week-rows": weekRows } as CSSProperties}
      >
        {cells.map((cell, index) => {
          if (!cell.date) {
            return <span key={`empty-${index}`} className="progress__cal-day progress__cal-day--empty" />;
          }

          const dayNum = Number(cell.date.slice(-2));
          const isSelected = cell.date === selectedDate;
          const isToday = todayDate != null && cell.date === todayDate;

          return (
            <button
              key={cell.date}
              type="button"
              className={[
                "progress__cal-day",
                COLOR_CLASS[cell.color ?? "pending"],
                isToday ? "progress__cal-day--today" : "",
                isSelected ? "progress__cal-day--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDate(cell.date!)}
              aria-label={isToday ? `${cell.date}, сегодня` : cell.date}
              aria-current={isToday ? "date" : undefined}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function formatMonthParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(year!, monthNum! - 1 + delta, 1);
  return formatMonthParam(date);
}

export function getMonthTitle(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const label = new Date(year!, monthNum! - 1, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
