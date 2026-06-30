import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SideToggle } from "../../components/SideToggle/SideToggle";
import { useHabitSide } from "../../features/shell/SideContext";
import { CalendarLegend } from "../../features/progress/CalendarLegend";
import { AnimatedCalendarStage } from "../../features/progress/AnimatedCalendarStage";
import {
  formatMonthParam,
  getMonthTitle,
  MonthCalendar,
  shiftMonth,
} from "../../features/progress/MonthCalendar";
import {
  calendarSlideClass,
  useCalendarMonthSlide,
} from "../../features/progress/useCalendarMonthSlide";
import { useTodayDashboard } from "../../features/today/useTodayData";
import { ClientApiError, getStatsCalendar, getStatsMonth } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";

function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

export function ProgressPage() {
  const { side } = useHabitSide();
  const [month, setMonth] = useState(() => formatMonthParam(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { slideDirection, beginSlide } = useCalendarMonthSlide();

  const { dashboard } = useTodayDashboard(side);
  const todayDate = dashboard?.date ?? null;
  const monthSyncedRef = useRef(false);

  useEffect(() => {
    if (!todayDate || monthSyncedRef.current) {
      return;
    }
    setMonth(monthFromDate(todayDate));
    monthSyncedRef.current = true;
  }, [todayDate]);

  useEffect(() => {
    if (todayDate && monthFromDate(todayDate) === month) {
      setSelectedDate(todayDate);
      return;
    }
    setSelectedDate(null);
  }, [month, side]);

  useEffect(() => {
    if (!todayDate || monthFromDate(todayDate) !== month) {
      return;
    }
    setSelectedDate((current) => current ?? todayDate);
  }, [todayDate, month]);

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

  const calendarPayload =
    calendarQuery.data?.month === month ? calendarQuery.data : null;
  const monthPayload = monthQuery.data?.month === month ? monthQuery.data : null;

  const selectedDay = useMemo(() => {
    if (!selectedDate || !calendarPayload) return null;
    return calendarPayload.days.find((day) => day.date === selectedDate) ?? null;
  }, [calendarPayload, selectedDate]);

  const isCalendarInitialLoading =
    (calendarQuery.isLoading && !calendarPayload) ||
    (monthQuery.isLoading && !monthPayload);
  const isCalendarRefreshing =
    slideDirection === "none" &&
    ((calendarQuery.isFetching && Boolean(calendarPayload)) ||
      (monthQuery.isFetching && Boolean(monthPayload)));

  const goMonth = (delta: -1 | 1) => {
    beginSlide(delta);
    setMonth((current) => shiftMonth(current, delta));
  };

  const titleClass = calendarSlideClass("progress__month-title", slideDirection);
  const gridClass = calendarSlideClass("progress__calendar-grid", slideDirection);

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
            onClick={() => goMonth(-1)}
            aria-label="Предыдущий месяц"
          >
            ‹
          </button>
          <h2
            key={`${side}-${month}`}
            id="month-heading"
            className={["home__section-title", titleClass].join(" ")}
          >
            {getMonthTitle(month)}
          </h2>
          <button
            type="button"
            className="progress__month-btn"
            onClick={() => goMonth(1)}
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
          <>
            <AnimatedCalendarStage measureKey={`${side}-${month}-${calendarPayload ? "ready" : "loading"}`}>
              <div
                key={`${side}-${month}`}
                className={[
                  gridClass,
                  isCalendarRefreshing ? "progress__calendar-grid--refreshing" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {calendarPayload ? (
                  <MonthCalendar
                    month={month}
                    days={calendarPayload.days}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    todayDate={todayDate}
                  />
                ) : (
                  <div
                    className="progress__calendar-skeleton progress__calendar-skeleton--inline"
                    aria-busy="true"
                    aria-label="Загрузка календаря"
                  />
                )}
              </div>
            </AnimatedCalendarStage>

            <CalendarLegend />

            {monthPayload ? (
              <div className="progress__month-summary">
                <div className="home__stat-card home__stat-card--primary">
                  <span className="home__stat-label">Успешных дней</span>
                  <span className="home__stat-value">{monthPayload.success_days}</span>
                </div>
                <div className="home__stat-card home__stat-card--light">
                  <span className="home__stat-label">% успеха</span>
                  <span className="home__stat-value">{monthPayload.success_rate}%</span>
                </div>
                <div className="home__stat-card home__stat-card--light">
                  <span className="home__stat-label">Срывы</span>
                  <span className="home__stat-value">{monthPayload.relapses}</span>
                </div>
                <div className="home__stat-card home__stat-card--light">
                  <span className="home__stat-label">Закрытых дней</span>
                  <span className="home__stat-value">{monthPayload.closed_days}</span>
                </div>
              </div>
            ) : null}
          </>
        )}

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
    </>
  );
}
