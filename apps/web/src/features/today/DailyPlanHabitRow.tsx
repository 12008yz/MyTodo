import { useState } from "react";
import type { DailyPlanBlock, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import { CollapsibleReveal } from "../../components/CollapsibleReveal";
import {
  formatGoalLabel,
  formatTimer,
  formatUnit,
  statusLabel,
} from "./format";
import { HabitIcon } from "./HabitIcon";
import type { TodaySide } from "./useTodayData";
import { useCheckinMutation } from "./useTodayData";

function PlanInfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 8.25V13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="9" cy="5.75" r="0.9" fill="currentColor" />
    </svg>
  );
}

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

function actionLabel(habit: TodayLightHabit | TodayDarkHabit, block: DailyPlanBlock | null): string {
  if (block) {
    return block.status === "active" ? "Идёт фокус" : "Начать";
  }

  if (habit.type === "limit") {
    return "Внести";
  }

  return "Готово";
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const status = habit.checkin?.status;

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

  const badge = resolveBadge(habit, block);

  return (
    <article
      className={["home__plan-item", detailsOpen ? "home__plan-item--details-open" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="home__plan-item-top">
        <div className="home__plan-item-main">
          <h3 className="home__plan-item-title">
            <HabitIcon icon={habit.icon ?? block?.icon} side={side} />
            <span>
              {habit.name} — {formatGoalLabel(habit)}
            </span>
          </h3>

          {timer ? (
            <div className="home__task-timer-hero">
              <span className="home__task-timer-label">Чистое время</span>
              <strong className="home__task-timer-value">{formatTimer(timer.elapsed)}</strong>
            </div>
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
                {hasActiveFocus ? "Идёт фокус" : actionLabel(habit, block)}
              </button>
            ) : null}

            {habit.type === "abstinence" ? (
              <button
                type="button"
                className="home__task-btn home__task-btn--danger"
                disabled={isPending || status === "fail"}
                onClick={() => void runCheckin({ habit_id: habit.id, status: "fail" })}
              >
                Я сорвался
              </button>
            ) : null}
          </div>

          {actionError ? <p className="home__task-error">{actionError}</p> : null}
        </div>

        <div className="home__plan-item-aside">
          <span className={["home__plan-badge", badge.className].join(" ")}>{badge.label}</span>
          <button
            type="button"
            className="home__plan-info-btn"
            aria-expanded={detailsOpen}
            aria-label={detailsOpen ? "Скрыть подробности" : "Подробнее о привычке"}
            onClick={() => setDetailsOpen((value) => !value)}
          >
            <PlanInfoIcon className="home__plan-info-btn-icon" />
          </button>
        </div>
      </div>

      <CollapsibleReveal
        open={detailsOpen}
        className="home__plan-item-drawer"
        contentClassName="home__plan-item-drawer-inner"
      >
        <div className="home__plan-item-drawer-body">
          <p className="home__plan-item-drawer-title">Подробнее</p>
          <p className="home__plan-item-drawer-text">
            Здесь появятся подсказки, прогресс и дополнительные действия для этой привычки.
          </p>
        </div>
      </CollapsibleReveal>
    </article>
  );
}
