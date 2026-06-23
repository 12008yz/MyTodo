import type { DayColorValue } from "@mytodo/shared";

const COLOR_CLASS: Record<DayColorValue, string> = {
  success: "progress__cal-day--success",
  pending: "progress__cal-day--pending",
  fail: "progress__cal-day--fail",
  skipped: "progress__cal-day--skipped",
};

const WEEKDAY_HEADERS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

type MonthCalendarProps = {
  month: string;
  days: Array<{ date: string; color: DayColorValue }>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
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

  while (cells.length % 7 !== 0) {
    cells.push({ date: null });
  }

  return cells;
}

export function MonthCalendar({ month, days, selectedDate, onSelectDate }: MonthCalendarProps) {
  const cells = buildCalendarCells(month, days);

  return (
    <div className="progress__calendar" aria-label={`Календарь: ${getMonthLabel(month)}`}>
      <div className="progress__cal-weekdays">
        {WEEKDAY_HEADERS.map((label) => (
          <span key={label} className="progress__cal-weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="progress__cal-grid">
        {cells.map((cell, index) => {
          if (!cell.date) {
            return <span key={`empty-${index}`} className="progress__cal-day progress__cal-day--empty" />;
          }

          const dayNum = Number(cell.date.slice(-2));
          const isSelected = cell.date === selectedDate;

          return (
            <button
              key={cell.date}
              type="button"
              className={[
                "progress__cal-day",
                COLOR_CLASS[cell.color ?? "pending"],
                isSelected ? "progress__cal-day--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDate(cell.date!)}
              aria-label={cell.date}
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
