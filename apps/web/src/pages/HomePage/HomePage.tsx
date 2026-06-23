import { useEffect, useMemo, useState } from "react";
import type { TodayLightResponse } from "@mytodo/shared";
import { useAuth } from "../../features/auth/AuthProvider";
import { HabitTaskCard } from "../../features/today/HabitTaskCard";
import { useTodayDashboard, type TodayDashboard, type TodaySide } from "../../features/today/useTodayData";
import { getPlaceholderWeekDays, WeekStrip } from "../../features/today/WeekStrip";
import { ClientApiError } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";
import { requestPushSubscription } from "../../lib/push";
import "./HomePage.css";

function isLightDashboard(dashboard: TodayDashboard | undefined): dashboard is TodayLightResponse {
  return dashboard !== undefined && "daily_budget_min" in dashboard;
}

function getUserInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

function AddIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M7 14H21" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 7V21" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function HomePage() {
  const { user, logout } = useAuth();
  const [side, setSide] = useState<TodaySide>("light");
  const placeholderWeek = useMemo(() => getPlaceholderWeekDays(), []);
  const { dashboard, week, isLoading, isError, error } = useTodayDashboard(side);

  const name = dashboard?.greeting_name ?? user?.name ?? "Пользователь";
  const habits = dashboard?.habits ?? [];
  const stats = dashboard?.stats;
  const pendingCount = habits.filter((h) => !h.checkin || h.checkin.status === "pending").length;

  useEffect(() => {
    void requestPushSubscription();
  }, []);

  const weekDays = week?.days ?? placeholderWeek;

  return (
    <div className="home" data-side={side}>
      <div className="home__side-stage" aria-hidden="true">
        <div className="home__side-layer home__side-layer--light" />
        <div className="home__side-layer home__side-layer--dark" />
      </div>

      <div className="home__blobs home__blobs--light" aria-hidden="true">
        <span className="home__blob home__blob--green" />
        <span className="home__blob home__blob--purple-left" />
        <span className="home__blob home__blob--purple-right" />
        <span className="home__blob home__blob--yellow" />
        <span className="home__blob home__blob--blue" />
        <span className="home__blob home__blob--orange" />
      </div>

      <div className="home__blobs home__blobs--dark" aria-hidden="true">
        <span className="home__blob home__blob--dark-purple" />
        <span className="home__blob home__blob--dark-orange" />
        <span className="home__blob home__blob--dark-blue" />
        <span className="home__blob home__blob--dark-violet" />
      </div>

      <div className="home__scroll">
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
          <button
            type="button"
            className="home__logout"
            onClick={() => void logout()}
          >
            Выход
          </button>
        </header>

        {isDemoMode() ? (
          <p className="home__demo-banner" role="status">
            Демо-режим — всё работает локально в браузере, без сервера.
          </p>
        ) : null}

        <div className="home__side-toggle" role="tablist" aria-label="Сторона привычек" data-active={side}>
          <span className="home__side-indicator" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={side === "light"}
            className={["home__side-btn", side === "light" ? "is-active" : ""].filter(Boolean).join(" ")}
            onClick={() => setSide("light")}
          >
            ☀️ Светлая
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={side === "dark"}
            className={["home__side-btn", side === "dark" ? "is-active" : ""].filter(Boolean).join(" ")}
            onClick={() => setSide("dark")}
          >
            🌑 Тёмная
          </button>
        </div>

        <WeekStrip days={weekDays} today={dashboard?.date} />

        <section className="home__section home__section--stats" aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="home__section-title">
            Статистика
          </h2>
          <div className="home__stats-grid">
            <div className="home__stat-card home__stat-card--primary">
              <span className="home__stat-label">Выполнено сегодня</span>
              <span className="home__stat-value">{isLoading ? "…" : (stats?.completed_today ?? 0)}</span>
            </div>
            <div className="home__stat-card home__stat-card--light">
              <span className="home__stat-label">Срывы за неделю</span>
              <span className="home__stat-value">{isLoading ? "…" : (stats?.relapses_this_week ?? 0)}</span>
            </div>
            <div className="home__stat-card home__stat-card--primary">
              <span className="home__stat-label">Минут / 🍅</span>
              <span className="home__stat-value">
                {isLoading
                  ? "…"
                  : `${stats?.minutes_today ?? 0} / ${stats?.pomodoros_today ?? 0}`}
              </span>
            </div>
            <div className="home__stat-card home__stat-card--light">
              <span className="home__stat-label">Серия дней</span>
              <span className="home__stat-value">{isLoading ? "…" : (stats?.streak_days ?? 0)}</span>
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
          ) : isLoading ? (
            <p className="home__placeholder">Загрузка привычек…</p>
          ) : habits.length === 0 ? (
            <p className="home__placeholder">
              Нет активных привычек на {side === "light" ? "светлой" : "тёмной"} стороне.
            </p>
          ) : (
            <div className="home__tasks-list">
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
      </div>

      <nav className="home__navbar" aria-label="Основная навигация">
        <div className="home__navbar-bg" aria-hidden="true">
          <svg
            className="home__navbar-bg-svg"
            viewBox="0 0 375 56"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="home__navbar-bg-path"
              d="M0 22C0 9.84974 9.84974 0 22 0H93.5H141C141 0 145.5 0 154 0C164.148 0 162 27 187.5 27C214.5 27 210.735 -5.64924e-06 220.5 0C229 4.91738e-06 233.5 0 233.5 0H282.5H353C365.15 0 375 9.84974 375 22V56H0V22Z"
            />
          </svg>
        </div>
        <button
          type="button"
          className="home__nav-item home__nav-item--home home__nav-item--active"
          aria-label="Сегодня"
        >
          <img src="/navbar/home.svg" alt="" />
        </button>
        <button type="button" className="home__nav-item home__nav-item--calendar" aria-label="Календарь">
          <img src="/navbar/calendar.svg" alt="" />
        </button>
        <button type="button" className="home__nav-item home__nav-item--document" aria-label="Список">
          <img src="/navbar/todo-list.svg" alt="" />
        </button>
        <button type="button" className="home__nav-item home__nav-item--profile" aria-label="Профиль">
          <img src="/navbar/profile-2user.svg" alt="" />
        </button>
        <button type="button" className="home__nav-add" aria-label="Добавить">
          <AddIcon />
        </button>
      </nav>
    </div>
  );
}
