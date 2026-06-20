import { useAuth } from "../../features/auth/AuthProvider";
import "./HomePage.css";

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
  const name = user?.name ?? "Пользователь";

  return (
    <div className="home">
      <div className="home__blobs" aria-hidden="true">
        <span className="home__blob home__blob--green" />
        <span className="home__blob home__blob--purple-left" />
        <span className="home__blob home__blob--purple-right" />
        <span className="home__blob home__blob--yellow" />
        <span className="home__blob home__blob--blue" />
        <span className="home__blob home__blob--orange" />
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

        <section className="home__section home__section--stats" aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="home__section-title">
            Статистика
          </h2>
          <div className="home__stats-grid">
            <div className="home__stat-card home__stat-card--light">
              <span className="home__stat-label">Привычки</span>
              <span className="home__stat-value">—</span>
            </div>
            <div className="home__stat-card home__stat-card--primary">
              <span className="home__stat-label">Выполнено</span>
              <span className="home__stat-value">—</span>
            </div>
            <div className="home__stat-card home__stat-card--primary">
              <span className="home__stat-label">Сегодня</span>
              <span className="home__stat-value">—</span>
            </div>
            <div className="home__stat-card home__stat-card--light">
              <span className="home__stat-label">Неделя</span>
              <span className="home__stat-value">—</span>
            </div>
          </div>
        </section>

        <section className="home__section home__section--tasks" aria-labelledby="tasks-heading">
          <div className="home__tasks-heading">
            <h2 id="tasks-heading" className="home__section-title">
              Сегодня
            </h2>
            <span className="home__tasks-count">0</span>
          </div>
          <p className="home__placeholder">
            Дашборд привычек подключим в следующем блоке frontend.
            {user?.trial_ends_at
              ? ` Trial до ${new Date(user.trial_ends_at).toLocaleDateString("ru-RU")}.`
              : ""}
          </p>
        </section>
      </div>

      <nav className="home__navbar" aria-label="Основная навигация">
        <div className="home__navbar-bg" aria-hidden="true" />
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
