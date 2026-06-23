import { useEffect, useState } from "react";
import type { TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import {
  formatGoalLabel,
  formatTimer,
  formatUnit,
  priorityFromStatus,
  statusLabel,
} from "./format";
import type { TodaySide } from "./useTodayData";
import { useCheckinMutation } from "./useTodayData";
import { ClientApiError } from "../../lib/api";

type HabitTaskCardProps = {
  habit: TodayLightHabit | TodayDarkHabit;
  side: TodaySide;
};

function hasTimerField(habit: TodayLightHabit | TodayDarkHabit): habit is TodayDarkHabit {
  return "timer" in habit;
}

export function HabitTaskCard({ habit, side }: HabitTaskCardProps) {
  const checkinMutation = useCheckinMutation(side);
  const [actionError, setActionError] = useState<string | null>(null);
  const status = habit.checkin?.status;
  const priority = priorityFromStatus(status);
  const [value, setValue] = useState(habit.checkin?.value ?? 0);

  useEffect(() => {
    setValue(habit.checkin?.value ?? 0);
  }, [habit.checkin?.value]);

  const isPending = checkinMutation.isPending;

  const runCheckin = async (payload: Parameters<typeof checkinMutation.mutateAsync>[0]) => {
    setActionError(null);
    try {
      await checkinMutation.mutateAsync(payload);
    } catch (err) {
      setActionError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось сохранить",
      );
    }
  };

  const saveValue = () => {
    void runCheckin({ habit_id: habit.id, value });
  };

  const markFail = () => {
    void runCheckin({ habit_id: habit.id, status: "fail" });
  };

  const markSkipped = () => {
    void runCheckin({ habit_id: habit.id, status: "skipped" });
  };

  const icon = habit.icon ?? (side === "light" ? "☀️" : "🌑");
  const timer = hasTimerField(habit) ? habit.timer : null;

  return (
    <article className="home__task-card">
      <span
        className={[
          "home__task-indicator",
          `home__task-indicator--${priority}`,
        ].join(" ")}
        aria-hidden="true"
      />
      <h3 className="home__task-title">
        {icon} {habit.name} — {formatGoalLabel(habit)}
      </h3>

      {timer ? (
        <p className="home__task-timer">Чистое время: {formatTimer(timer.elapsed)}</p>
      ) : null}

      {!timer && habit.type !== "abstinence" ? (
        <div className="home__task-slider">
          <input
            type="range"
            min={0}
            max={Math.max(habit.current_goal * 2, habit.current_goal + 1)}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            disabled={isPending || status === "success"}
          />
          <span className="home__task-slider-value">
            {value} {formatUnit(habit.unit)}
          </span>
        </div>
      ) : null}

      <div className="home__task-footer">
        <div className="home__task-meta">
          <span className="home__task-time">
            {status === "success"
              ? `Завтра: ${habit.preview_next_goal}`
              : `Сегодня: ${habit.checkin?.value ?? 0} ${formatUnit(habit.unit)}`}
          </span>
        </div>
        <span className={["home__task-priority", `home__task-priority--${priority}`].join(" ")}>
          {statusLabel(status, habit.type)}
        </span>
      </div>

      <div className="home__task-actions">
        {habit.type === "abstinence" ? (
          <button
            type="button"
            className="home__task-btn home__task-btn--danger"
            disabled={isPending || status === "fail"}
            onClick={markFail}
          >
            Сорвался
          </button>
        ) : status !== "success" ? (
          <button
            type="button"
            className="home__task-btn"
            disabled={isPending}
            onClick={saveValue}
          >
            Сохранить
          </button>
        ) : null}

        {habit.allows_weekly_skip && status !== "skipped" && status !== "success" ? (
          <button
            type="button"
            className="home__task-btn home__task-btn--ghost"
            disabled={isPending}
            onClick={markSkipped}
          >
            Пропустить
          </button>
        ) : null}
      </div>

      {actionError ? <p className="home__task-error">{actionError}</p> : null}
    </article>
  );
}
