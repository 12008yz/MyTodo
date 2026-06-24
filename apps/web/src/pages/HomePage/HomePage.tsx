import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { TodayLightResponse } from "@mytodo/shared";
import { SideToggle } from "../../components/SideToggle/SideToggle";
import { useAuth } from "../../features/auth/AuthProvider";
import { useHabitSide } from "../../features/shell/SideContext";
import { DailyPlanList } from "../../features/today/DailyPlanList";
import { HabitTaskCard } from "../../features/today/HabitTaskCard";
import { useTodayDashboard, type TodayDashboard } from "../../features/today/useTodayData";
import { getPlaceholderWeekDays, WeekStrip } from "../../features/today/WeekStrip";
import { ClientApiError } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";

function isLightDashboard(dashboard: TodayDashboard | undefined): dashboard is TodayLightResponse {
  return dashboard !== undefined && "daily_budget_min" in dashboard;
}

function hasDailyPlan(
  dashboard: TodayDashboard | undefined,
): dashboard is TodayDashboard & { daily_plan: NonNullable<TodayDashboard["daily_plan"]> } {
  return Boolean(dashboard?.daily_plan);
}

function getUserInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

export function HomePage() {
  const { user } = useAuth();
  const { side } = useHabitSide();
  const placeholderWeek = useMemo(() => getPlaceholderWeekDays(), []);
  const { dashboard, week, isLoading, isFetching, isError, error } = useTodayDashboard(side);

  const name = dashboard?.greeting_name ?? user?.name ?? "Пользователь";
  const habits = dashboard?.habits ?? [];
  const stats = dashboard?.stats;
  const pendingCount = habits.filter((h) => !h.checkin || h.checkin.status === "pending").length;
  const weekDays = week?.days ?? placeholderWeek;

  return (
    <>
      <header className="home__header">
        <div className="home__profile">
          <span className="home__avatar" aria-hidden="true">
            {getUserInitial(name)}
          </span>
          <div className="home__greeting">
            <span className="home__hello">Привет!</span>
            <span className="home__name">{name}</span>
          </div>
        </div>
        <Link to="/profile" className="home__profile-link">
          Профиль
        </Link>
      </header>

      {isDemoMode() ? (
        <p className="home__demo-banner" role="status">
          Демо-режим — всё работает локально в браузере, без сервера.
        </p>
      ) : null}

      <SideToggle />

      <WeekStrip days={weekDays} today={dashboard?.date} />

      <section className="home__section home__section--stats" aria-labelledby="stats-heading">
        <div className="home__section-heading-row">
          <h2 id="stats-heading" className="home__section-title">
            Статистика
          </h2>
          <Link to="/progress" className="home__section-link">
            Подробнее →
          </Link>
        </div>
        <div className="home__stats-grid">
          <div className="home__stat-card home__stat-card--primary">
            <span className="home__stat-label">Выполнено сегодня</span>
            <span className="home__stat-value">
              {isLoading && !stats ? "…" : (stats?.completed_today ?? 0)}
            </span>
          </div>
          <div className="home__stat-card home__stat-card--light">
            <span className="home__stat-label">Срывы за неделю</span>
            <span className="home__stat-value">
              {isLoading && !stats ? "…" : (stats?.relapses_this_week ?? 0)}
            </span>
          </div>
          <div className="home__stat-card home__stat-card--primary">
            <span className="home__stat-label">Минут / 🍅</span>
            <span className="home__stat-value">
              {isLoading && !stats
                ? "…"
                : `${stats?.minutes_today ?? 0} / ${stats?.pomodoros_today ?? 0}`}
            </span>
          </div>
          <div className="home__stat-card home__stat-card--light">
            <span className="home__stat-label">Серия дней</span>
            <span className="home__stat-value">
              {isLoading && !stats ? "…" : (stats?.streak_days ?? 0)}
            </span>
          </div>
        </div>
      </section>

      <section className="home__section home__section--tasks" aria-labelledby="tasks-heading">
        <div className="home__tasks-heading">
          <h2 id="tasks-heading" className="home__section-title">
            Сегодня
          </h2>
          <span className="home__tasks-count">{pendingCount}</span>
        </div>

        {isError ? (
          <p className="home__placeholder home__placeholder--error">
            {error instanceof ClientApiError
              ? error.message
              : "Не удалось загрузить привычки"}
          </p>
        ) : isLoading && habits.length === 0 ? (
          <div className="home__tasks-skeleton" aria-busy="true" aria-label="Загрузка привычек" />
        ) : habits.length === 0 ? (
          <p className="home__placeholder">
            Нет активных привычек на {side === "light" ? "светлой" : "тёмной"} стороне.
          </p>
        ) : (
          <div
            className={[
              "home__tasks-list",
              "home__side-panel",
              isFetching && habits.length > 0 ? "home__side-panel--refreshing" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {habits.map((habit) => (
              <HabitTaskCard key={habit.id} habit={habit} side={side} />
            ))}
          </div>
        )}

        {isLightDashboard(dashboard) ? (
          <p className="home__budget">
            Сегодня: {dashboard.minutes_logged_today} из {dashboard.daily_budget_min} мин
          </p>
        ) : null}

        {user?.trial_ends_at ? (
          <p className="home__trial">
            Trial до {new Date(user.trial_ends_at).toLocaleDateString("ru-RU")}
          </p>
        ) : null}
      </section>

      {hasDailyPlan(dashboard) ? <DailyPlanList dailyPlan={dashboard.daily_plan} side={side} /> : null}
    </>
  );
}
