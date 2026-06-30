import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ProgressPeriod } from "@mytodo/shared";
import { useHabitSide } from "../shell/SideContext";
import { useTodayDashboard } from "../today/useTodayData";
import { ClientApiError, getHabitProgress } from "../../lib/api";
import { HabitProgressChart } from "./HabitProgressChart";

const PERIOD_OPTIONS: { value: ProgressPeriod; label: string }[] = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
];

export function HabitProgressSection() {
  const { side } = useHabitSide();
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [period, setPeriod] = useState<ProgressPeriod>("month");

  const { dashboard } = useTodayDashboard(side);
  const habits = dashboard?.habits ?? [];

  useEffect(() => {
    if (habits.length === 0) {
      setSelectedHabitId(null);
      return;
    }
    if (!selectedHabitId || !habits.some((habit) => habit.id === selectedHabitId)) {
      setSelectedHabitId(habits[0]!.id);
    }
  }, [habits, selectedHabitId]);

  const progressQuery = useQuery({
    queryKey: ["stats-progress", side, selectedHabitId, period],
    queryFn: () => getHabitProgress(selectedHabitId!, period),
    enabled: Boolean(selectedHabitId),
    placeholderData: keepPreviousData,
  });

  if (habits.length === 0) {
    return (
      <p className="home__placeholder">
        Нет привычек на {side === "light" ? "светлой" : "тёмной"} стороне
      </p>
    );
  }

  return (
    <>
      <label className="progress__habit-select">
        <span className="progress__habit-select-label">Привычка</span>
        <select
          className="progress__habit-select-input"
          value={selectedHabitId ?? ""}
          onChange={(event) => setSelectedHabitId(event.target.value)}
        >
          {habits.map((habit) => (
            <option key={habit.id} value={habit.id}>
              {habit.name}
            </option>
          ))}
        </select>
      </label>

      <div className="progress__period-toggle" role="tablist" aria-label="Период графика">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={period === option.value}
            className={[
              "progress__period-btn",
              period === option.value ? "progress__period-btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setPeriod(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <HabitProgressChart
        data={progressQuery.data}
        isLoading={progressQuery.isLoading && !progressQuery.data}
        isFetching={progressQuery.isFetching && Boolean(progressQuery.data)}
        error={
          progressQuery.isError
            ? progressQuery.error instanceof ClientApiError
              ? progressQuery.error.message
              : "Не удалось загрузить график"
            : null
        }
      />
    </>
  );
}
