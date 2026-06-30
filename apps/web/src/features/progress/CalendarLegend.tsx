import type { DayColorValue } from "@mytodo/shared";

const LEGEND_ITEMS: Array<{ color: DayColorValue; label: string }> = [
  { color: "success", label: "Всё выполнено" },
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

export function CalendarLegend() {
  return (
    <ul className="progress__legend" aria-label="Обозначения цветов календаря">
      {LEGEND_ITEMS.map((item) => (
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
