import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ProgressPeriod } from "@mytodo/shared";
import { SideToggle } from "../../components/SideToggle/SideToggle";
import { useHabitSide } from "../../features/shell/SideContext";
import { HabitProgressChart } from "../../features/progress/HabitProgressChart";
import {
  formatMonthParam,
  getMonthTitle,
  MonthCalendar,
  shiftMonth,
} from "../../features/progress/MonthCalendar";
import { useTodayDashboard } from "../../features/today/useTodayData";
import { ClientApiError, getHabitProgress, getStatsCalendar, getStatsMonth } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";

const PERIOD_OPTIONS: { value: ProgressPeriod; label: string }[] = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
];

export function ProgressPage() {
  const { side } = useHabitSide();
  const [month, setMonth] = useState(() => formatMonthParam(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [period, setPeriod] = useState<ProgressPeriod>("month");

  const { dashboard } = useTodayDashboard(side);
  const habits = dashboard?.habits ?? [];

  useEffect(() => {
    setSelectedDate(null);
  }, [month, side]);

  useEffect(() => {
    if (habits.length === 0) {
      setSelectedHabitId(null);
      return;
    }
    if (!selectedHabitId || !habits.some((habit) => habit.id === selectedHabitId)) {
      setSelectedHabitId(habits[0]!.id);
    }
  }, [habits, selectedHabitId]);

  const calendarQuery = useQuery({
    queryKey: ["stats-calendar", month, side],
    queryFn: () => getStatsCalendar(month, side),
    placeholderData: keepPreviousData,
  });

  const monthQuery = useQuery({
    queryKey: ["stats-month", month, side],
    queryFn: () => getStatsMonth(month, side),
    placeholderData: keepPreviousData,
  });

  const progressQuery = useQuery({
    queryKey: ["stats-progress", side, selectedHabitId, period],
    queryFn: () => getHabitProgress(selectedHabitId!, period),
    enabled: Boolean(selectedHabitId),
    placeholderData: keepPreviousData,
  });

  const selectedDay = useMemo(() => {
    if (!selectedDate || !calendarQuery.data) return null;
    return calendarQuery.data.days.find((day) => day.date === selectedDate) ?? null;
  }, [calendarQuery.data, selectedDate]);

  const isCalendarInitialLoading =
    (calendarQuery.isLoading && !calendarQuery.data) ||
    (monthQuery.isLoading && !monthQuery.data);
  const isCalendarRefreshing =
    (calendarQuery.isFetching && Boolean(calendarQuery.data)) ||
    (monthQuery.isFetching && Boolean(monthQuery.data));

  return (
    <>
      <header className="home__page-header">
        <h1 className="home__page-title">Прогресс</h1>
      </header>

      {isDemoMode() ? (
        <p className="home__demo-banner" role="status">
          Демо-режим — данные считаются локально.
        </p>
      ) : null}

      <SideToggle />

      <section className="home__section" aria-labelledby="month-heading">
        <div className="progress__month-nav">
          <button
            type="button"
            className="progress__month-btn"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
            aria-label="Предыдущий месяц"
          >
            ‹
          </button>
          <h2 id="month-heading" className="home__section-title progress__month-title">
            {getMonthTitle(month)}
          </h2>
          <button
            type="button"
            className="progress__month-btn"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
            aria-label="Следующий месяц"
          >
            ›
          </button>
        </div>

        {calendarQuery.isError ? (
          <p className="home__placeholder home__placeholder--error">
            {calendarQuery.error instanceof ClientApiError
              ? calendarQuery.error.message
              : "Не удалось загрузить календарь"}
          </p>
        ) : isCalendarInitialLoading ? (
          <div className="progress__calendar-skeleton" aria-busy="true" aria-label="Загрузка календаря" />
        ) : (
          <div
            className={[
              "home__side-panel",
              isCalendarRefreshing ? "home__side-panel--refreshing" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <MonthCalendar
              month={month}
              days={calendarQuery.data?.days ?? []}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        )}

        {monthQuery.data ? (
          <div className="progress__month-summary">
            <div className="home__stat-card home__stat-card--primary">
              <span className="home__stat-label">Успешных дней</span>
              <span className="home__stat-value">{monthQuery.data.success_days}</span>
            </div>
            <div className="home__stat-card home__stat-card--light">
              <span className="home__stat-label">Срывы</span>
              <span className="home__stat-value">{monthQuery.data.relapses}</span>
            </div>
          </div>
        ) : null}

        {selectedDay ? (
          <div className="progress__day-detail">
            <h3 className="progress__day-detail-title">
              {new Date(`${selectedDay.date}T12:00:00`).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              })}
            </h3>
            {selectedDay.habits.length === 0 ? (
              <p className="home__placeholder">Нет привычек на этот день</p>
            ) : (
              <ul className="progress__day-habits">
                {selectedDay.habits.map((habit) => (
                  <li key={habit.habit_id} className="progress__day-habit">
                    <span>{habit.name}</span>
                    <span className={`progress__day-status progress__day-status--${habit.status}`}>
                      {habit.status === "success"
                        ? "✓"
                        : habit.status === "fail"
                          ? "✗"
                          : habit.status === "skipped"
                            ? "—"
                            : "…"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section className="home__section" aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="home__section-title">
          График привычки
        </h2>

        {habits.length === 0 ? (
          <p className="home__placeholder">
            Нет привычек на {side === "light" ? "светлой" : "тёмной"} стороне
          </p>
        ) : (
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
        )}
      </section>
    </>
  );
}
