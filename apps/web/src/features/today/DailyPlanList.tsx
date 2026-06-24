import { useCallback, useEffect, useMemo, useState } from "react";
import type { DailyPlan, DailyPlanBlock, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import { FocusScreen } from "../sessions/FocusScreen";
import { ValuePrompt } from "../sessions/ValuePrompt";
import { useCompleteHabitSession, useStartHabitSession } from "../sessions/useHabitSession";
import { useSessionTimer } from "../sessions/useSessionTimer";
import { DailyPlanHabitRow } from "./DailyPlanHabitRow";
import type { TodaySide } from "./useTodayData";

const EMPTY_PLAN: DailyPlan = {
  blocks: [],
  minutes_planned: 0,
  minutes_completed: 0,
  minutes_remaining: 0,
};

type DailyPlanListProps = {
  dailyPlan?: DailyPlan | null;
  habits: (TodayLightHabit | TodayDarkHabit)[];
  side: TodaySide;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  error?: unknown;
  minutesLoggedToday?: number;
  dailyBudgetMin?: number;
  trialEndsAt?: string | null;
};

type ValuePromptState = {
  block: DailyPlanBlock;
  endedEarly: boolean;
} | null;

type FocusState = {
  block: DailyPlanBlock;
  plannedMin: number;
} | null;

function toErrorText(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить действие";
}

function orderHabits(
  habits: (TodayLightHabit | TodayDarkHabit)[],
  blocks: DailyPlanBlock[],
): (TodayLightHabit | TodayDarkHabit)[] {
  const blockOrder = new Map(blocks.map((block, index) => [block.habit_id, index]));

  return [...habits].sort((left, right) => {
    const leftOrder = blockOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = blockOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name, "ru");
  });
}

export function DailyPlanList({
  dailyPlan,
  habits,
  side,
  isLoading = false,
  isFetching = false,
  isError = false,
  error,
  minutesLoggedToday,
  dailyBudgetMin,
  trialEndsAt,
}: DailyPlanListProps) {
  const plan = dailyPlan ?? EMPTY_PLAN;
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
    () => [...plan.blocks].sort((left, right) => left.order - right.order),
    [plan.blocks],
  );

  const blockByHabitId = useMemo(() => {
    const map = new Map<string, DailyPlanBlock>();
    for (const block of blocks) {
      map.set(block.habit_id, block);
    }
    return map;
  }, [blocks]);

  const orderedHabits = useMemo(() => orderHabits(habits, blocks), [habits, blocks]);

  const progressPercent =
    plan.minutes_planned > 0
      ? Math.min(100, Math.round((plan.minutes_completed / plan.minutes_planned) * 100))
      : 0;

  const submitCompletion = useCallback(
    async (block: DailyPlanBlock, payload: { value: number; endedEarly: boolean }) => {
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
      } catch (submitError) {
        setActionError(toErrorText(submitError));
      }
    },
    [completeSession],
  );

  const handleStart = useCallback(
    async (block: DailyPlanBlock) => {
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
      } catch (startError) {
        setActionError(toErrorText(startError));
      }
    },
    [startSession],
  );

  const finishCurrentSession = useCallback(
    async (endedEarly: boolean) => {
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
    },
    [focusState, isEnding, submitCompletion, timer.elapsedMin],
  );

  useEffect(() => {
    if (focusState && timer.isFinished && !isEnding) {
      void finishCurrentSession(false);
    }
  }, [finishCurrentSession, focusState, isEnding, timer.isFinished]);

  const isBusy = startSession.isPending || completeSession.isPending || isEnding;
  const focusHabitId = focusState?.block.habit_id ?? null;

  return (
    <section className="home__section home__section--plan" aria-labelledby="plan-heading">
      <div className="home__section-heading-row">
        <h2 id="plan-heading" className="home__section-title">
          План дня
        </h2>
        <span className="home__plan-summary">
          {plan.minutes_completed}/{plan.minutes_planned} мин
        </span>
      </div>

      <div
        className="home__plan-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <span className="home__plan-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {isError ? (
        <p className="home__placeholder home__placeholder--error">
          {error instanceof ClientApiError
            ? error.message
            : "Не удалось загрузить привычки"}
        </p>
      ) : isLoading && habits.length === 0 ? (
        <div className="home__tasks-skeleton" aria-busy="true" aria-label="Загрузка плана дня" />
      ) : habits.length === 0 ? (
        <p className="home__placeholder">
          Нет активных привычек на {side === "light" ? "светлой" : "тёмной"} стороне.
        </p>
      ) : (
        <div
          className={[
            "home__plan-list",
            "home__side-panel",
            isFetching && habits.length > 0 ? "home__side-panel--refreshing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {orderedHabits.map((habit) => {
            const block = blockByHabitId.get(habit.id) ?? null;
            const hasActiveFocus = focusHabitId === habit.id;

            return (
              <DailyPlanHabitRow
                key={habit.id}
                habit={habit}
                block={block}
                side={side}
                hasActiveFocus={hasActiveFocus}
                sessionBusy={isBusy}
                focusLocked={Boolean(focusHabitId && !hasActiveFocus)}
                onStart={block ? () => void handleStart(block) : undefined}
              />
            );
          })}
        </div>
      )}

      {minutesLoggedToday != null && dailyBudgetMin != null ? (
        <p className="home__budget">
          Сегодня: {minutesLoggedToday} из {dailyBudgetMin} мин
        </p>
      ) : null}

      {trialEndsAt ? (
        <p className="home__trial">
          Trial до {new Date(trialEndsAt).toLocaleDateString("ru-RU")}
        </p>
      ) : null}

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
        inputLabel={side === "dark" ? "Сколько всего сегодня?" : "Сколько сделал?"}
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
