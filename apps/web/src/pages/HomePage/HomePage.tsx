import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { TodayLightResponse } from "@mytodo/shared";
import { SideToggle } from "../../components/SideToggle/SideToggle";
import { useAuth } from "../../features/auth/AuthProvider";
import { useHabitSide } from "../../features/shell/SideContext";
import { DailyPlanList } from "../../features/today/DailyPlanList";
import { useTodayDashboard, type TodayDashboard } from "../../features/today/useTodayData";
import { getPlaceholderWeekDays, WeekStrip } from "../../features/today/WeekStrip";
import { isDemoMode } from "../../lib/demo-mode";

function isLightDashboard(dashboard: TodayDashboard | undefined): dashboard is TodayLightResponse {
  return dashboard !== undefined && "daily_budget_min" in dashboard;
}

function getUserInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

export function HomePage() {
  const { user } = useAuth();
  const { side } = useHabitSide();
  const placeholderWeek = useMemo(() => getPlaceholderWeekDays(), []);
  const lightDashboard = useTodayDashboard("light");
  const darkDashboard = useTodayDashboard("dark");
  const activeDashboard = side === "light" ? lightDashboard : darkDashboard;

  const dashboard = activeDashboard.dashboard;
  const week = activeDashboard.week;
  const { isLoading } = activeDashboard;

  const name = dashboard?.greeting_name ?? user?.name ?? "Пользователь";
  const stats = dashboard?.stats;
  const weekDays = week?.days ?? placeholderWeek;
  const lightData = lightDashboard.dashboard;
  const darkData = darkDashboard.dashboard;

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

      <DailyPlanList
        activeSide={side}
        light={{
          dailyPlan: lightData?.daily_plan,
          habits: lightData?.habits ?? [],
          isLoading: lightDashboard.isLoading,
          isFetching: lightDashboard.isFetching,
          isError: lightDashboard.isError,
          error: lightDashboard.error,
        }}
        dark={{
          dailyPlan: darkData?.daily_plan,
          habits: darkData?.habits ?? [],
          isLoading: darkDashboard.isLoading,
          isFetching: darkDashboard.isFetching,
          isError: darkDashboard.isError,
          error: darkDashboard.error,
        }}
        minutesLoggedToday={isLightDashboard(lightData) ? lightData.minutes_logged_today : undefined}
        dailyBudgetMin={isLightDashboard(lightData) ? lightData.daily_budget_min : undefined}
        trialEndsAt={user?.trial_ends_at}
        wakeTime={user?.wake_time}
      />
    </>
  );
}
