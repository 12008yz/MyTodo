const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);

const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0"),
);

function parseTime(value: string): { hours: string; minutes: string } {
  const [hoursPart = "07", minutesPart = "00"] = value.split(":");
  const hours = hoursPart.padStart(2, "0").slice(0, 2);
  const parsedMinutes = Number(minutesPart);
  const snappedMinutes = Number.isFinite(parsedMinutes)
    ? Math.min(55, Math.round(parsedMinutes / 5) * 5)
    : 0;

  return {
    hours: HOUR_OPTIONS.includes(hours) ? hours : "07",
    minutes: String(snappedMinutes).padStart(2, "0"),
  };
}

function formatTime(hours: string, minutes: string): string {
  return `${hours}:${minutes}`;
}

type TimeInput24Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function TimeInput24({ value, onChange, id }: TimeInput24Props) {
  const { hours, minutes } = parseTime(value);
  const hourId = id ? `${id}-hour` : undefined;
  const minuteId = id ? `${id}-minute` : undefined;

  return (
    <div className="onboarding__time-field">
      <select
        id={hourId}
        className="onboarding__time-field-part"
        value={hours}
        aria-label="Часы"
        onChange={(event) => onChange(formatTime(event.target.value, minutes))}
      >
        {HOUR_OPTIONS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="onboarding__time-field-sep" aria-hidden="true">
        :
      </span>
      <select
        id={minuteId}
        className="onboarding__time-field-part"
        value={minutes}
        aria-label="Минуты"
        onChange={(event) => onChange(formatTime(hours, event.target.value))}
      >
        {MINUTE_OPTIONS.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
    </div>
  );
}
