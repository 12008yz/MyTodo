import { useCallback, useEffect, useMemo, useState } from "react";
import type { DailyPlan, DailyPlanBlock } from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import { FocusScreen } from "../sessions/FocusScreen";
import { ValuePrompt } from "../sessions/ValuePrompt";
import { useCompleteHabitSession, useStartHabitSession } from "../sessions/useHabitSession";
import { useSessionTimer } from "../sessions/useSessionTimer";
import { formatUnit } from "./format";
import type { TodaySide } from "./useTodayData";

type DailyPlanListProps = {
  dailyPlan: DailyPlan;
  side: TodaySide;
};

type ValuePromptState = {
  block: DailyPlanBlock;
  endedEarly: boolean;
} | null;

type FocusState = {
  block: DailyPlanBlock;
  plannedMin: number;
} | null;

function blockStatusLabel(status: DailyPlanBlock["status"]): string {
  switch (status) {
    case "completed":
      return "Сделано";
    case "active":
      return "В процессе";
    default:
      return "Ожидает";
  }
}

function toErrorText(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить действие";
}

export function DailyPlanList({ dailyPlan, side }: DailyPlanListProps) {
  const startSession = useStartHabitSession(side);
  const completeSession = useCompleteHabitSession(side);
  const [focusState, setFocusState] = useState<FocusState>(null);
  const [valuePrompt, setValuePrompt] = useState<ValuePromptState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const timer = useSessionTimer({
    plannedMin: focusState?.plannedMin ?? 0,
    autoStart: Boolean(focusState),
  });

  const blocks = useMemo(
    () => [...dailyPlan.blocks].sort((left, right) => left.order - right.order),
    [dailyPlan.blocks],
  );

  const progressPercent =
    dailyPlan.minutes_planned > 0
      ? Math.min(100, Math.round((dailyPlan.minutes_completed / dailyPlan.minutes_planned) * 100))
      : 0;

  const submitCompletion = useCallback(async (
    block: DailyPlanBlock,
    payload: { value: number; endedEarly: boolean },
  ) => {
    setActionError(null);
    try {
      await completeSession.mutateAsync({
        habitId: block.habit_id,
        payload: {
          block_id: block.id,
          actual_value: payload.value,
          ended_early: payload.endedEarly,
        },
      });
    } catch (error) {
      setActionError(toErrorText(error));
    }
  }, [completeSession]);

  const handleStart = useCallback(async (block: DailyPlanBlock) => {
    setActionError(null);
    try {
      const session = await startSession.mutateAsync({
        habitId: block.habit_id,
        payload: {
          block_id: block.id,
          planned_min: block.duration_min,
        },
      });
      setFocusState({
        block,
        plannedMin: session.planned_min,
      });
    } catch (error) {
      setActionError(toErrorText(error));
    }
  }, [startSession]);

  const finishCurrentSession = useCallback(async (endedEarly: boolean) => {
    if (!focusState || isEnding) {
      return;
    }

    setIsEnding(true);
    const elapsedValue = Math.max(timer.elapsedMin, 0);
    const currentBlock = focusState.block;
    setFocusState(null);

    if (currentBlock.unit === "minutes") {
      await submitCompletion(currentBlock, { value: elapsedValue, endedEarly });
      setIsEnding(false);
      return;
    }

    setValuePrompt({
      block: currentBlock,
      endedEarly,
    });
    setIsEnding(false);
  }, [focusState, isEnding, submitCompletion, timer.elapsedMin]);

  useEffect(() => {
    if (focusState && timer.isFinished && !isEnding) {
      void finishCurrentSession(false);
    }
  }, [finishCurrentSession, focusState, isEnding, timer.isFinished]);

  const isBusy = startSession.isPending || completeSession.isPending || isEnding;

  return (
    <section className="home__section home__section--plan" aria-labelledby="plan-heading">
      <div className="home__section-heading-row">
        <h2 id="plan-heading" className="home__section-title">
          План дня
        </h2>
        <span className="home__plan-summary">
          {dailyPlan.minutes_completed}/{dailyPlan.minutes_planned} мин
        </span>
      </div>

      <div className="home__plan-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
        <span className="home__plan-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="home__plan-list home__side-panel">
        {blocks.map((block) => {
          const isCompleted = block.status === "completed";
          const hasActiveFocus = focusState?.block.id === block.id;
          const isDisabled = isBusy || Boolean(focusState && !hasActiveFocus) || isCompleted;

          return (
            <article key={block.id} className="home__plan-item">
              <div className="home__plan-item-main">
                <h3 className="home__plan-item-title">{block.habit_name}</h3>
                <p className="home__plan-item-meta">
                  {block.duration_min} мин · ожидание {block.expected_yield} {formatUnit(block.unit)}
                </p>
                <p className="home__plan-item-result">
                  Факт: {block.actual_value ?? 0} {formatUnit(block.unit)}
                </p>
              </div>
              <div className="home__plan-item-aside">
                <span className={`home__plan-badge home__plan-badge--${block.status}`}>
                  {blockStatusLabel(block.status)}
                </span>
                <button
                  type="button"
                  className="home__task-btn"
                  disabled={isDisabled}
                  onClick={() => void handleStart(block)}
                >
                  {hasActiveFocus ? "Идет фокус" : "Начать"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {actionError ? <p className="home__task-error">{actionError}</p> : null}

      <FocusScreen
        isOpen={Boolean(focusState)}
        habitName={focusState?.block.habit_name ?? ""}
        remainingSeconds={timer.remainingSeconds}
        isPaused={timer.isPaused}
        onTogglePause={timer.togglePause}
        onStopEarly={() => void finishCurrentSession(true)}
      />

      <ValuePrompt
        isOpen={Boolean(valuePrompt)}
        habitName={valuePrompt?.block.habit_name ?? ""}
        unit={valuePrompt?.block.unit ?? "pieces"}
        expectedYield={valuePrompt?.block.expected_yield ?? 0}
        isSubmitting={completeSession.isPending}
        onCancel={() => setValuePrompt(null)}
        onSubmit={(value) => {
          if (!valuePrompt) {
            return;
          }

          void (async () => {
            await submitCompletion(valuePrompt.block, {
              value,
              endedEarly: valuePrompt.endedEarly,
            });
            setValuePrompt(null);
          })();
        }}
      />
    </section>
  );
}
