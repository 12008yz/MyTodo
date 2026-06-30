import type { DayColorValue, StatsSide } from "@mytodo/shared";

const LIGHT_LEGEND: Array<{ color: DayColorValue; label: string }> = [
  { color: "success", label: "Всё выполнено" },
  { color: "pending", label: "День не закрыт" },
  { color: "fail", label: "Срыв" },
  { color: "skipped", label: "Пропуск" },
];

const DARK_LEGEND: Array<{ color: DayColorValue; label: string }> = [
  { color: "success", label: "Удержался" },
  { color: "pending", label: "День не закрыт" },
  { color: "fail", label: "Срыв" },
  { color: "skipped", label: "Пропуск" },
];

const SWATCH_CLASS: Record<DayColorValue, string> = {
  success: "progress__legend-swatch--success",
  pending: "progress__legend-swatch--pending",
  fail: "progress__legend-swatch--fail",
  skipped: "progress__legend-swatch--skipped",
};

type CalendarLegendProps = {
  side: StatsSide;
};

export function CalendarLegend({ side }: CalendarLegendProps) {
  const items = side === "dark" ? DARK_LEGEND : LIGHT_LEGEND;

  return (
    <ul className="progress__legend" aria-label="Обозначения цветов календаря">
      {items.map((item) => (
        <li key={item.color} className="progress__legend-item">
          <span
            className={["progress__legend-swatch", SWATCH_CLASS[item.color]].join(" ")}
            aria-hidden="true"
          />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
