import { useEffect, useState } from "react";
import type { TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import {
  formatGoalLabel,
  formatTimer,
  formatUnit,
  priorityFromStatus,
  statusLabel,
} from "./format";
import { HabitIcon } from "./HabitIcon";
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
  const [manualValue, setManualValue] = useState(String(habit.checkin?.value ?? 0));
  const [isManualOpen, setIsManualOpen] = useState(false);

  useEffect(() => {
    setManualValue(String(habit.checkin?.value ?? 0));
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

  const saveManualValue = async () => {
    const value = Number(manualValue);
    if (!Number.isFinite(value) || value < 0) {
      setActionError("Введите корректное число");
      return;
    }

    await runCheckin({ habit_id: habit.id, value });
    setIsManualOpen(false);
  };

  const markFail = () => {
    void runCheckin({ habit_id: habit.id, status: "fail" });
  };

  const markSkipped = () => {
    void runCheckin({ habit_id: habit.id, status: "skipped" });
  };

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
        <HabitIcon icon={habit.icon} side={side} />
        <span>
          {habit.name} — {formatGoalLabel(habit)}
        </span>
      </h3>

      {timer ? (
        <p className="home__task-timer">Чистое время: {formatTimer(timer.elapsed)}</p>
      ) : null}

      {!timer && habit.type !== "abstinence" ? (
        <p className="home__task-progress">
          Прогресс: {habit.checkin?.value ?? 0} / {habit.current_goal} {formatUnit(habit.unit)}
        </p>
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
            onClick={() => setIsManualOpen((value) => !value)}
          >
            Ввести вручную
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

      {isManualOpen && habit.type !== "abstinence" ? (
        <div className="home__task-manual">
          <input
            type="number"
            min={0}
            step={habit.unit === "minutes" ? 1 : "any"}
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            className="home__task-manual-input"
            disabled={isPending}
          />
          <button
            type="button"
            className="home__task-btn"
            disabled={isPending}
            onClick={() => void saveManualValue()}
          >
            Сохранить
          </button>
          <button
            type="button"
            className="home__task-btn home__task-btn--ghost"
            disabled={isPending}
            onClick={() => setIsManualOpen(false)}
          >
            Отмена
          </button>
        </div>
      ) : null}

      {actionError ? <p className="home__task-error">{actionError}</p> : null}
    </article>
  );
}
