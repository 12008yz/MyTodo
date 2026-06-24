import { useEffect, useState } from "react";
import type { DailyPlanBlock, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import {
  formatGoalLabel,
  formatTimer,
  formatUnit,
  statusLabel,
} from "./format";
import { HabitIcon } from "./HabitIcon";
import type { TodaySide } from "./useTodayData";
import { useCheckinMutation } from "./useTodayData";

type DailyPlanHabitRowProps = {
  habit: TodayLightHabit | TodayDarkHabit;
  block: DailyPlanBlock | null;
  side: TodaySide;
  hasActiveFocus: boolean;
  sessionBusy: boolean;
  focusLocked: boolean;
  onStart?: () => void;
};

function hasTimerField(habit: TodayLightHabit | TodayDarkHabit): habit is TodayDarkHabit {
  return "timer" in habit;
}

function resolveBadge(
  habit: TodayLightHabit | TodayDarkHabit,
  block: DailyPlanBlock | null,
): { label: string; className: string } {
  const status = habit.checkin?.status;

  if (block?.status === "active") {
    return { label: "Фокус", className: "home__plan-badge--active" };
  }

  if (status === "success") {
    return { label: statusLabel(status, habit.type), className: "home__plan-badge--completed" };
  }

  if (status === "fail") {
    return { label: statusLabel(status, habit.type), className: "home__plan-badge--fail" };
  }

  if (status === "skipped") {
    return { label: statusLabel(status, habit.type), className: "home__plan-badge--pending" };
  }

  return { label: statusLabel(status, habit.type), className: "home__plan-badge--pending" };
}

export function DailyPlanHabitRow({
  habit,
  block,
  side,
  hasActiveFocus,
  sessionBusy,
  focusLocked,
  onStart,
}: DailyPlanHabitRowProps) {
  const checkinMutation = useCheckinMutation(side);
  const [actionError, setActionError] = useState<string | null>(null);
  const status = habit.checkin?.status;
  const [manualValue, setManualValue] = useState(String(habit.checkin?.value ?? 0));
  const [isManualOpen, setIsManualOpen] = useState(false);

  useEffect(() => {
    setManualValue(String(habit.checkin?.value ?? 0));
  }, [habit.checkin?.value]);

  const isPending = checkinMutation.isPending;
  const timer = hasTimerField(habit) ? habit.timer : null;
  const blockCompleted = block?.status === "completed";
  const canStartSession = Boolean(block && !blockCompleted && onStart);
  const startDisabled = sessionBusy || focusLocked || blockCompleted || !canStartSession;

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

  const badge = resolveBadge(habit, block);

  return (
    <article className="home__plan-item">
      <div className="home__plan-item-main">
        <h3 className="home__plan-item-title">
          <HabitIcon icon={habit.icon ?? block?.icon} side={side} />
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

        {block ? (
          <p className="home__plan-item-meta">
            {block.duration_min} мин · ожидание {block.expected_yield} {formatUnit(block.unit)}
            {block.status === "completed" ? (
              <>
                {" "}
                · факт: {block.actual_value ?? 0} {formatUnit(block.unit)}
              </>
            ) : null}
          </p>
        ) : null}

        <div className="home__task-footer">
          <span className="home__task-time">
            {status === "success"
              ? `Завтра: ${habit.preview_next_goal}`
              : `Сегодня: ${habit.checkin?.value ?? 0} ${formatUnit(habit.unit)}`}
          </span>
        </div>

        <div className="home__task-actions">
          {canStartSession ? (
            <button
              type="button"
              className="home__task-btn"
              disabled={startDisabled}
              onClick={onStart}
            >
              {hasActiveFocus ? "Идёт фокус" : "Начать"}
            </button>
          ) : null}

          {habit.type === "abstinence" ? (
            <button
              type="button"
              className="home__task-btn home__task-btn--danger"
              disabled={isPending || status === "fail"}
              onClick={() => void runCheckin({ habit_id: habit.id, status: "fail" })}
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
              onClick={() => void runCheckin({ habit_id: habit.id, status: "skipped" })}
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
      </div>

      <div className="home__plan-item-aside">
        <span className={["home__plan-badge", badge.className].join(" ")}>{badge.label}</span>
      </div>
    </article>
  );
}
