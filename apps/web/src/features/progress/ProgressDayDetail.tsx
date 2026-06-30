import type { StatsCalendarResponse } from "@mytodo/shared";
import {
  formatProgressDayHabitDetail,
  progressDayStatusSymbol,
} from "./formatProgressDayHabit";

type ProgressDay = StatsCalendarResponse["days"][number];

type ProgressDayDetailProps = {
  day: ProgressDay;
};

export function ProgressDayDetail({ day }: ProgressDayDetailProps) {
  return (
    <div className="progress__day-detail">
      <h3 className="progress__day-detail-title">
        {new Date(`${day.date}T12:00:00`).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
        })}
      </h3>
      {day.habits.length === 0 ? (
        <p className="home__placeholder">Нет привычек на этот день</p>
      ) : (
        <ul className="progress__day-habits">
          {day.habits.map((habit) => {
            const detail = formatProgressDayHabitDetail(habit);
            return (
              <li key={habit.habit_id} className="progress__day-habit">
                <div className="progress__day-habit-main">
                  <span className="progress__day-habit-name">{habit.name}</span>
                  {detail ? <span className="progress__day-habit-detail">{detail}</span> : null}
                </div>
                <span
                  className={`progress__day-status progress__day-status--${habit.status}`}
                  aria-label={detail ?? habit.status}
                >
                  {progressDayStatusSymbol(habit.status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
