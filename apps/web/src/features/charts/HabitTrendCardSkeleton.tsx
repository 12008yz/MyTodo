import "./HabitTrendCard.css";

type HabitTrendCardSkeletonProps = {
  variant?: "light-side" | "dark-side";
};

export function HabitTrendCardSkeleton({ variant = "light-side" }: HabitTrendCardSkeletonProps) {
  return (
    <article
      className={[
        "habit-trend-card",
        "habit-trend-card--skeleton",
        `habit-trend-card--${variant}`,
      ].join(" ")}
      aria-busy="true"
      aria-label="Загрузка диаграммы"
    >
      <header className="habit-trend-card__header">
        <div className="habit-trend-card__heading">
          <div className="habit-trend-card__title-row">
            <span className="habit-trend-card__skeleton-line habit-trend-card__skeleton-line--title" />
            <span className="habit-trend-card__skeleton-line habit-trend-card__skeleton-line--total" />
          </div>
          <span className="habit-trend-card__skeleton-line habit-trend-card__skeleton-line--subtitle" />
        </div>
      </header>

      <div className="habit-trend-card__skeleton-chart" aria-hidden="true" />

      <div className="habit-trend-card__legend habit-trend-card__legend--skeleton" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className="habit-trend-card__skeleton-line habit-trend-card__skeleton-line--legend"
          />
        ))}
      </div>
    </article>
  );
}
