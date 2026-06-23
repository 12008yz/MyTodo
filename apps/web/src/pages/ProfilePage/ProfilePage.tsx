import { useAuth } from "../../features/auth/AuthProvider";
import { HARSHNESS_OPTIONS } from "../../features/onboarding/constants";
import { isDemoMode } from "../../lib/demo-mode";
import { requestPushSubscription } from "../../lib/push";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

export function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return <p className="home__placeholder">Загрузка профиля…</p>;
  }

  const harshness = HARSHNESS_OPTIONS.find((option) => option.level === user.harshness_level);

  return (
    <>
      <header className="home__page-header">
        <h1 className="home__page-title">Профиль</h1>
      </header>

      {isDemoMode() ? (
        <p className="home__demo-banner" role="status">
          Демо-режим — настройки сохраняются локально.
        </p>
      ) : null}

      <section className="home__section profile__section" aria-labelledby="account-heading">
        <h2 id="account-heading" className="home__section-title">
          Аккаунт
        </h2>
        <dl className="profile__list">
          <div className="profile__row">
            <dt>Имя</dt>
            <dd>{user.name}</dd>
          </div>
          <div className="profile__row">
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          {user.trial_ends_at ? (
            <div className="profile__row">
              <dt>Trial</dt>
              <dd>до {new Date(user.trial_ends_at).toLocaleDateString("ru-RU")}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="home__section profile__section" aria-labelledby="schedule-heading">
        <h2 id="schedule-heading" className="home__section-title">
          Режим дня
        </h2>
        <dl className="profile__list">
          <div className="profile__row">
            <dt>Подъём</dt>
            <dd>{formatTime(user.wake_time)}</dd>
          </div>
          <div className="profile__row">
            <dt>Сон</dt>
            <dd>{formatTime(user.sleep_time)}</dd>
          </div>
          <div className="profile__row">
            <dt>Часовой пояс</dt>
            <dd>{user.timezone}</dd>
          </div>
          <div className="profile__row">
            <dt>Бюджет в день</dt>
            <dd>{user.daily_budget_min} мин</dd>
          </div>
        </dl>
      </section>

      <section className="home__section profile__section" aria-labelledby="coach-heading">
        <h2 id="coach-heading" className="home__section-title">
          Наставник
        </h2>
        <p className="profile__card">
          {harshness ? `${harshness.emoji} ${harshness.title}` : `Уровень ${user.harshness_level}`}
        </p>
      </section>

      <section className="home__section profile__section" aria-labelledby="pomodoro-heading">
        <h2 id="pomodoro-heading" className="home__section-title">
          Помодоро
        </h2>
        <dl className="profile__list">
          <div className="profile__row">
            <dt>Работа</dt>
            <dd>{user.pomodoro_work_min} мин</dd>
          </div>
          <div className="profile__row">
            <dt>Перерыв</dt>
            <dd>{user.pomodoro_break_min} мин</dd>
          </div>
          <div className="profile__row">
            <dt>Длинный перерыв</dt>
            <dd>{user.pomodoro_long_break_min} мин</dd>
          </div>
        </dl>
      </section>

      <section className="home__section profile__section" aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="home__section-title">
          Модули
        </h2>
        <div className="profile__card profile__card--muted">
          <strong>Английский</strong>
          <p>Скоро: уроки дня и настройки модуля</p>
        </div>
        <div className="profile__card profile__card--muted">
          <strong>Залог</strong>
          <p>Финансовый контракт с собой — 5000 ₽ за привычку</p>
        </div>
        <div className="profile__card profile__card--muted">
          <strong>Подписка</strong>
          <p>Тарифы и оплата через ЮKassa</p>
        </div>
      </section>

      <section className="home__section profile__section" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading" className="home__section-title">
          Уведомления
        </h2>
        <button
          type="button"
          className="profile__action-btn"
          onClick={() => void requestPushSubscription()}
        >
          Включить push-уведомления
        </button>
      </section>

      <section className="home__section profile__section">
        <button type="button" className="profile__logout-btn" onClick={() => void logout()}>
          Выйти из аккаунта
        </button>
      </section>
    </>
  );
}
