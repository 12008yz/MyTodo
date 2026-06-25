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

function getDayGreeting(): { emoji: string; title: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { emoji: "☀️", title: "Доброе утро" };
  if (hour < 18) return { emoji: "🌤️", title: "Добрый день" };
  return { emoji: "🌙", title: "Добрый вечер" };
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
  const activeHabits = dashboard?.habits ?? [];
  const pendingCount = activeHabits.filter((habit) => !habit.checkin || habit.checkin.status === "pending").length;
  const completedCount = activeHabits.filter((habit) => habit.checkin?.status === "success").length;
  const dayGreeting = getDayGreeting();
  const progressCurrent = side === "light" && isLightDashboard(lightData)
    ? lightData.minutes_logged_today
    : completedCount;
  const progressTarget = side === "light" && isLightDashboard(lightData)
    ? lightData.daily_budget_min
    : Math.max(activeHabits.length, 1);
  const progressPercent =
    progressTarget > 0 ? Math.min(100, Math.round((progressCurrent / progressTarget) * 100)) : 0;
  const heroSubtitle = activeHabits.length === 0
    ? (side === "light"
      ? "Собери первую привычку и создай красивый ритм дня."
      : "Добавь первую привычку контроля и начни держать линию.")
    : completedCount === 0
      ? "Сегодня ты ещё не начинал. Самый лучший момент — прямо сейчас."
      : pendingCount === 0
        ? "На сегодня всё закрыто. Можно спокойно выдохнуть."
        : `Уже закрыто ${completedCount}. Осталось ещё ${pendingCount}.`;
  const heroNote = side === "light" && isLightDashboard(lightData)
    ? `${lightData.minutes_logged_today} из ${lightData.daily_budget_min} мин сегодня`
    : `${completedCount} из ${activeHabits.length} привычек под контролем`;
  const statsSummary = stats?.completed_today
    ? `Сегодня уже есть движение: ${stats.completed_today} выполнено, серия ${stats.streak_days} дн.`
    : "Здесь появятся итоги дня, когда ты сделаешь первый шаг.";

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
          Всё готово к твоему первому дню. Можно спокойно настроить ритм и посмотреть сценарии.
        </p>
      ) : null}

      <section className="home__hero" aria-labelledby="home-hero-title">
        <div className="home__hero-greeting">
          <span className="home__hero-emoji" aria-hidden="true">
            {dayGreeting.emoji}
          </span>
          <div className="home__hero-copy">
            <h2 id="home-hero-title" className="home__hero-title">
              {dayGreeting.title}, {name}!
            </h2>
            <p className="home__hero-subtitle">{heroSubtitle}</p>
          </div>
        </div>

        <div className="home__hero-progress">
          <div className="home__hero-progress-row">
            <span className="home__hero-progress-label">Прогресс дня</span>
            <span className="home__hero-progress-value">
              {side === "light" ? `${progressCurrent} / ${progressTarget} мин` : `${progressCurrent} / ${progressTarget}`}
            </span>
          </div>
          <div
            className="home__hero-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <span className="home__hero-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="home__hero-note">{heroNote}</p>
        </div>
      </section>

      <SideToggle />

      <WeekStrip days={weekDays} today={dashboard?.date} />

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
      />

      <section className="home__section home__section--stats" aria-labelledby="stats-heading">
        <div className="home__section-heading-row">
          <div className="home__stats-heading-copy">
            <h2 id="stats-heading" className="home__section-title">
              Статистика
            </h2>
            <p className="home__stats-summary">{statsSummary}</p>
          </div>
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
    </>
  );
}
