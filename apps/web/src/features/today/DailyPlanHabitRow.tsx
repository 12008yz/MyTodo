import { useState, type MouseEvent } from "react";
import type { DailyPlanBlock, HabitSessionResponse, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import { CollapsibleReveal } from "../../components/CollapsibleReveal";
import {
  formatGoalLabel,
  formatTimer,
  formatUnit,
  statusLabel,
} from "./format";
import { HabitIcon } from "./HabitIcon";
import { QuickAddPrompt } from "./QuickAddPrompt";
import type { TodaySide } from "./useTodayData";
import { useCheckinMutation } from "./useTodayData";
import {
  getLiveSessionProgress,
  getLiveSessionProgressLabel,
} from "../sessions/sessionProgress";
import { getSessionRemainingSeconds } from "../sessions/sessionRecovery";

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

function ChevronIcon({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : undefined }}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type DailyPlanHabitRowProps = {
  habit: TodayLightHabit | TodayDarkHabit;
  block: DailyPlanBlock | null;
  side: TodaySide;
  hasActiveFocus: boolean;
  resumeSession: HabitSessionResponse | null;
  sessionElapsedSeconds: number;
  isRecoveringSessions: boolean;
  sessionBusy: boolean;
  focusLocked: boolean;
  onStart?: () => void;
};

function formatSessionCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function hasTimerField(habit: TodayLightHabit | TodayDarkHabit): habit is TodayDarkHabit {
  return "timer" in habit;
}

function resolveBadge(
  habit: TodayLightHabit | TodayDarkHabit,
  _block: DailyPlanBlock | null,
): { label: string; className: string } {
  const status = habit.checkin?.status;

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

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, label"));
}

export function DailyPlanHabitRow({
  habit,
  block,
  side,
  hasActiveFocus,
  resumeSession,
  sessionElapsedSeconds,
  isRecoveringSessions,
  sessionBusy,
  focusLocked,
  onStart,
}: DailyPlanHabitRowProps) {
  const checkinMutation = useCheckinMutation(side);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const status = habit.checkin?.status;

  const isPending = checkinMutation.isPending;
  const timer = hasTimerField(habit) ? habit.timer : null;
  const goalReached = status === "success";
  const canStartSession = habit.type !== "abstinence" && Boolean(onStart);
  const startDisabled =
    sessionBusy || focusLocked || hasActiveFocus || !canStartSession;
  const canQuickAdd = habit.type === "target" && status !== "skipped";
  const currentValue = habit.checkin?.value ?? 0;
  const sessionProgress = getLiveSessionProgress(habit.unit, sessionElapsedSeconds);
  const hasSessionProgress = sessionProgress > 0;
  const progressValue = hasSessionProgress ? currentValue + sessionProgress : currentValue;
  const progressPercent =
    habit.type !== "abstinence" && habit.current_goal > 0
      ? Math.min(100, (progressValue / habit.current_goal) * 100)
      : 0;
  const progressLabelValue = hasSessionProgress
    ? habit.unit === "minutes" && progressValue < 10
      ? progressValue.toFixed(1)
      : String(
          Math.floor(
            currentValue + getLiveSessionProgressLabel(habit.unit, sessionElapsedSeconds),
          ),
        )
    : String(currentValue);
  const todayValue = hasSessionProgress ? progressLabelValue : String(currentValue);

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

  const handleQuickAdd = async (amount: number) => {
    setActionError(null);
    try {
      await checkinMutation.mutateAsync({
        habit_id: habit.id,
        value: currentValue + amount,
      });
      setQuickAddOpen(false);
    } catch (err) {
      setActionError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось добавить",
      );
    }
  };

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    setExpanded((value) => !value);
  };

  const badge = hasActiveFocus
    ? { label: "Фокус", className: "home__plan-badge--active" }
    : resumeSession
      ? { label: "В процессе", className: "home__plan-badge--active" }
      : resolveBadge(habit, block);

  const startLabel = hasActiveFocus
    ? "Идёт фокус"
    : resumeSession
      ? `Продолжить · ${formatSessionCountdown(getSessionRemainingSeconds(resumeSession))}`
      : isRecoveringSessions && block?.status === "active"
        ? "Продолжить..."
      : block?.status === "active"
      ? `Продолжить · ${block.duration_min} мин`
      : goalReached
      ? "Ещё сессия"
      : block
        ? `Начать · ${block.duration_min} мин`
        : "Начать";

  const quickAddChips = habit.unit === "minutes" ? [5, 10, 15] : [];

  return (
    <>
      <article
        className={[
          "home__plan-item",
          expanded ? "home__plan-item--expanded" : "",
          hasActiveFocus ? "home__plan-item--focus-active" : "",
          resumeSession ? "home__plan-item--session-paused" : "",
          goalReached ? "home__plan-item--completed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((value) => !value);
          }
        }}
      >
        <div className="home__plan-item-top">
          <div className="home__plan-item-main">
            <div className="home__plan-item-header">
              <h3 className="home__plan-item-title">
                <HabitIcon icon={habit.icon ?? block?.icon} side={side} />
                <span className="home__plan-item-name">{habit.name}</span>
              </h3>
              <span className="home__plan-item-goal">{formatGoalLabel(habit)}</span>
            </div>

            {timer ? (
              <p className="home__task-timer">Чистое время: {formatTimer(timer.elapsed)}</p>
            ) : null}

            {!timer && habit.type !== "abstinence" ? (
              <div className="home__plan-item-progress">
                <div
                  className="home__plan-item-progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={habit.current_goal}
                  aria-valuenow={Math.floor(progressValue)}
                >
                  <span
                    className="home__plan-item-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="home__task-progress">
                  {progressLabelValue} / {habit.current_goal} {formatUnit(habit.unit)}
                </p>
              </div>
            ) : null}

            {block && !goalReached ? (
              <p className="home__plan-item-meta">
                Сессия {block.duration_min} мин · ~{block.expected_yield}{" "}
                {formatUnit(block.unit)}
                {block.status === "completed" ? (
                  <>
                    {" "}
                    · факт: {block.actual_value ?? 0} {formatUnit(block.unit)}
                  </>
                ) : null}
              </p>
            ) : null}

            {goalReached ? (
              <p className="home__plan-item-meta home__plan-item-meta--success">
                Цель выполнена · завтра: {habit.preview_next_goal} {formatUnit(habit.unit)}
              </p>
            ) : (
              <p className="home__task-time">
                Сегодня: {todayValue} {formatUnit(habit.unit)}
              </p>
            )}

            <div className="home__task-actions">
              {canStartSession ? (
                <button
                  type="button"
                  className="home__task-btn home__task-btn--start"
                  disabled={startDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    onStart?.();
                  }}
                >
                  {startLabel}
                </button>
              ) : null}

              {canQuickAdd ? (
                <button
                  type="button"
                  className="home__task-btn home__task-btn--plus"
                  disabled={isPending || sessionBusy}
                  aria-label="Добавить сверх плана"
                  onClick={(event) => {
                    event.stopPropagation();
                    setQuickAddOpen(true);
                  }}
                >
                  +
                </button>
              ) : null}

              {habit.type === "abstinence" ? (
                <button
                  type="button"
                  className="home__task-btn home__task-btn--danger"
                  disabled={isPending || status === "fail"}
                  onClick={(event) => {
                    event.stopPropagation();
                    void runCheckin({ habit_id: habit.id, status: "fail" });
                  }}
                >
                  Сорвался
                </button>
              ) : null}

              <button
                type="button"
                className="home__plan-expand-btn"
                aria-expanded={expanded}
                aria-label={expanded ? "Свернуть" : "Развернуть"}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((value) => !value);
                }}
              >
                <ChevronIcon className="home__plan-expand-btn-icon" open={expanded} />
              </button>
            </div>

            {actionError ? <p className="home__task-error">{actionError}</p> : null}
          </div>

          <div className="home__plan-item-aside">
            <span className={["home__plan-badge", badge.className].join(" ")}>{badge.label}</span>
          </div>
        </div>

        <CollapsibleReveal
          open={expanded}
          className="home__plan-item-drawer"
          contentClassName="home__plan-item-drawer-inner"
        >
          <div className="home__plan-item-drawer-body">
            <p className="home__plan-item-drawer-title">
              <PlanInfoIcon className="home__plan-item-drawer-icon" />
              Подробнее
            </p>
            <p className="home__plan-item-drawer-text">
              {block
                ? `Следующая сессия: ${block.duration_min} мин. Ожидаемый результат — ~${block.expected_yield} ${formatUnit(block.unit)}.`
                : goalReached
                  ? "Цель на сегодня выполнена. Можно добавить сверх плана или начать ещё одну сессию."
                  : "Нажмите «Начать», чтобы запустить таймер фокуса."}
            </p>
            {side === "light" && status !== "success" && status !== "fail" ? (
              <button
                type="button"
                className="home__plan-drawer-btn"
                disabled={isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  void runCheckin({ habit_id: habit.id, status: "skipped" });
                }}
              >
                Пропустить сегодня
              </button>
            ) : null}
          </div>
        </CollapsibleReveal>
      </article>

      <QuickAddPrompt
        isOpen={quickAddOpen}
        habitName={habit.name}
        unit={habit.unit}
        chips={quickAddChips}
        isSubmitting={checkinMutation.isPending}
        onCancel={() => setQuickAddOpen(false)}
        onAdd={(amount) => void handleQuickAdd(amount)}
      />
    </>
  );
}
