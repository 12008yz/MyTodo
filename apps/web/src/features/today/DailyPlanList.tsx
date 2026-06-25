import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DailyPlan, DailyPlanBlock, HabitSessionResponse, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import { SESSION_TARGET_MIN } from "@mytodo/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ClientApiError } from "../../lib/api";
import { FocusScreen } from "../sessions/FocusScreen";
import { ValuePrompt } from "../sessions/ValuePrompt";
import {
  fetchActiveSession,
  finalizeInterruptedSession,
  isActiveSessionConflict,
  MIN_STALE_SESSION_SECONDS,
} from "../sessions/sessionRecovery";
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

export type SidePlanData = {
  dailyPlan?: DailyPlan | null;
  habits: (TodayLightHabit | TodayDarkHabit)[];
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  error?: unknown;
};

type DailyPlanListProps = {
  activeSide: TodaySide;
  light: SidePlanData;
  dark: SidePlanData;
  minutesLoggedToday?: number;
  dailyBudgetMin?: number;
  trialEndsAt?: string | null;
};

type ValuePromptState = {
  habitId: string;
  block: DailyPlanBlock;
  sessionBlockId: string | null;
  endedEarly: boolean;
  isPlanBlock: boolean;
} | null;

type FocusState = {
  habit: TodayLightHabit | TodayDarkHabit;
  block: DailyPlanBlock;
  sessionId: string;
  sessionBlockId: string | null;
  plannedMin: number;
  initialRemainingSeconds: number;
  isPlanBlock: boolean;
} | null;

function createFocusBlock(
  habit: TodayLightHabit | TodayDarkHabit,
  plannedMin: number,
): DailyPlanBlock {
  return {
    id: `bonus-${habit.id}`,
    habit_id: habit.id,
    habit_name: habit.name,
    icon: habit.icon ?? null,
    unit: habit.unit,
    duration_min: plannedMin,
    expected_yield: 0,
    order: 0,
    status: "pending",
    actual_value: null,
    actual_minutes: null,
  };
}

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

function getPlan(sideData: SidePlanData): DailyPlan {
  return sideData.dailyPlan ?? EMPTY_PLAN;
}

function resolveBlockForSession(
  plan: DailyPlan,
  fallback: DailyPlanBlock | null,
  sessionBlockId: string | null,
): DailyPlanBlock | null {
  if (sessionBlockId) {
    const matched = plan.blocks.find((block) => block.id === sessionBlockId);
    if (matched) {
      return matched;
    }
  }
  return fallback;
}

function buildFocusState(
  habit: TodayLightHabit | TodayDarkHabit,
  block: DailyPlanBlock | null,
  session: HabitSessionResponse,
  planBlockIds: Set<string>,
): FocusState {
  const isPlanBlock = Boolean(session.block_id && planBlockIds.has(session.block_id));

  return {
    habit,
    block: block ?? createFocusBlock(habit, session.planned_min),
    sessionId: session.id,
    sessionBlockId: session.block_id,
    plannedMin: session.planned_min,
    initialRemainingSeconds: session.remaining_seconds ?? session.planned_min * 60,
    isPlanBlock,
  };
}

type HabitListLayerProps = {
  side: TodaySide;
  sideData: SidePlanData;
  isActive: boolean;
  focusHabitId: string | null;
  sessionBusy: boolean;
  onStart: (habit: TodayLightHabit | TodayDarkHabit, block: DailyPlanBlock | null) => void;
};

function HabitListLayer({
  side,
  sideData,
  isActive,
  focusHabitId,
  sessionBusy,
  onStart,
}: HabitListLayerProps) {
  const plan = getPlan(sideData);
  const blocks = useMemo(
    () => [...plan.blocks].sort((left, right) => left.order - right.order),
    [plan.blocks],
  );
  const blockByHabitId = useMemo(() => {
    const map = new Map<string, DailyPlanBlock>();
    for (const block of blocks) {
      if (block.status !== "completed") {
        map.set(block.habit_id, block);
      }
    }
    return map;
  }, [blocks]);
  const orderedHabits = useMemo(() => orderHabits(sideData.habits, blocks), [sideData.habits, blocks]);

  let content: ReactNode;

  if (sideData.isError) {
    content = (
      <p className="home__placeholder home__placeholder--error">
        {sideData.error instanceof ClientApiError
          ? sideData.error.message
          : "Не удалось загрузить привычки"}
      </p>
    );
  } else if (sideData.isLoading && sideData.habits.length === 0) {
    content = (
      <div className="home__tasks-skeleton" aria-busy="true" aria-label="Загрузка плана дня" />
    );
  } else if (sideData.habits.length === 0) {
    content = (
      <p className="home__placeholder">
        Нет активных привычек на {side === "light" ? "светлой" : "тёмной"} стороне.
      </p>
    );
  } else {
    content = (
      <div
        className={[
          "home__plan-list",
          sideData.isFetching && sideData.habits.length > 0 ? "home__side-panel--refreshing" : "",
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
              sessionBusy={sessionBusy}
              focusLocked={Boolean(focusHabitId && !hasActiveFocus)}
              onStart={
                habit.type !== "abstinence"
                  ? () => onStart(habit, block)
                  : undefined
              }
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={[
        "home__plan-list-layer",
        isActive ? "home__plan-list-layer--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-side={side}
      aria-hidden={!isActive}
    >
      {content}
    </div>
  );
}

export function DailyPlanList({
  activeSide,
  light,
  dark,
  minutesLoggedToday,
  dailyBudgetMin,
  trialEndsAt,
}: DailyPlanListProps) {
  const activeData = activeSide === "light" ? light : dark;
  const plan = getPlan(activeData);
  const planBlockIds = useMemo(() => new Set(plan.blocks.map((block) => block.id)), [plan.blocks]);
  const queryClient = useQueryClient();
  const startSession = useStartHabitSession(activeSide);
  const completeSession = useCompleteHabitSession(activeSide);
  const [focusState, setFocusState] = useState<FocusState>(null);
  const [valuePrompt, setValuePrompt] = useState<ValuePromptState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryKeyRef = useRef<string | null>(null);

  const timer = useSessionTimer({
    sessionKey: focusState?.sessionId ?? null,
    plannedMin: focusState?.plannedMin ?? 0,
    initialRemainingSeconds: focusState?.initialRemainingSeconds,
    autoStart: true,
  });

  const progressPercent =
    plan.minutes_planned > 0
      ? Math.min(100, Math.round((plan.minutes_completed / plan.minutes_planned) * 100))
      : 0;

  const submitCompletion = useCallback(
    async (
      habitId: string,
      sessionBlockId: string | null,
      isPlanBlock: boolean,
      payload: { value: number; endedEarly: boolean },
    ) => {
      setActionError(null);
      try {
        await completeSession.mutateAsync({
          habitId,
          payload: {
            ...(isPlanBlock && sessionBlockId ? { block_id: sessionBlockId } : {}),
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

  const openFocusFromSession = useCallback(
    (
      habit: TodayLightHabit | TodayDarkHabit,
      block: DailyPlanBlock | null,
      session: HabitSessionResponse,
    ) => {
      const resolvedBlock = resolveBlockForSession(plan, block, session.block_id);
      setFocusState(buildFocusState(habit, resolvedBlock, session, planBlockIds));
    },
    [plan, planBlockIds],
  );

  const handleStart = useCallback(
    async (habit: TodayLightHabit | TodayDarkHabit, block: DailyPlanBlock | null) => {
      if (focusState || startSession.isPending || isEnding || isRecovering) {
        return;
      }

      setActionError(null);
      const plannedMin = block?.duration_min ?? SESSION_TARGET_MIN;
      const isPlanBlock = Boolean(block && planBlockIds.has(block.id));

      try {
        const activeSession = await fetchActiveSession(habit.id);
        if (activeSession) {
          openFocusFromSession(habit, block, activeSession);
          return;
        }

        const session = await startSession.mutateAsync({
          habitId: habit.id,
          payload: {
            ...(isPlanBlock && block ? { block_id: block.id } : {}),
            planned_min: plannedMin,
          },
        });
        openFocusFromSession(habit, block, session);
      } catch (startError) {
        if (isActiveSessionConflict(startError)) {
          try {
            const activeSession = await fetchActiveSession(habit.id);
            if (activeSession) {
              openFocusFromSession(habit, block, activeSession);
              return;
            }
          } catch {
            // fall through to generic error
          }
        }
        setActionError(toErrorText(startError));
      }
    },
    [focusState, isEnding, isRecovering, openFocusFromSession, planBlockIds, startSession],
  );

  const finishCurrentSession = useCallback(
    async (endedEarly: boolean) => {
      if (!focusState || isEnding) {
        return;
      }

      if (endedEarly && timer.elapsedSeconds < MIN_STALE_SESSION_SECONDS) {
        setActionError(`Подождите ещё ${MIN_STALE_SESSION_SECONDS - timer.elapsedSeconds} сек`);
        return;
      }

      setIsEnding(true);
      const elapsedValue = Math.max(timer.elapsedMin, 0);
      const currentFocus = focusState;
      setFocusState(null);

      if (currentFocus.block.unit === "minutes") {
        await submitCompletion(
          currentFocus.habit.id,
          currentFocus.sessionBlockId,
          currentFocus.isPlanBlock,
          { value: elapsedValue, endedEarly },
        );
        setIsEnding(false);
        return;
      }

      setValuePrompt({
        habitId: currentFocus.habit.id,
        block: currentFocus.block,
        sessionBlockId: currentFocus.sessionBlockId,
        endedEarly,
        isPlanBlock: currentFocus.isPlanBlock,
      });
      setIsEnding(false);
    },
    [focusState, isEnding, submitCompletion, timer.elapsedMin, timer.elapsedSeconds],
  );

  useEffect(() => {
    if (focusState && timer.isFinished && !isEnding) {
      void finishCurrentSession(false);
    }
  }, [finishCurrentSession, focusState, isEnding, timer.isFinished]);

  const isBusy =
    isRecovering ||
    Boolean(focusState) ||
    startSession.isPending ||
    completeSession.isPending ||
    isEnding;
  const focusHabitId = focusState?.habit.id ?? null;

  useEffect(() => {
    const sidesLoading = light.isLoading && dark.isLoading;
    if (sidesLoading) {
      return;
    }

    const habitsToRecover = [
      ...(light.isLoading ? [] : light.habits),
      ...(dark.isLoading ? [] : dark.habits),
    ].filter((habit) => habit.type !== "abstinence");

    const recoveryKey = habitsToRecover
      .map((habit) => habit.id)
      .sort()
      .join(",");
    if (recoveryKeyRef.current === recoveryKey) {
      return;
    }
    recoveryKeyRef.current = recoveryKey;

    let cancelled = false;
    setIsRecovering(true);

    void (async () => {
      let changed = false;

      for (const habit of habitsToRecover) {
        if (cancelled) {
          return;
        }

        try {
          const result = await finalizeInterruptedSession(habit.id, habit.unit);
          if (result === "completed" || result === "stopped") {
            changed = true;
          }
        } catch {
          // ignore per-habit recovery errors
        }
      }

      if (changed && !cancelled) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["today", "light"] }),
          queryClient.invalidateQueries({ queryKey: ["today", "dark"] }),
        ]);
      }

      if (!cancelled) {
        setIsRecovering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dark.habits, dark.isLoading, light.habits, light.isLoading, queryClient]);

  useEffect(() => {
    setFocusState(null);
    setValuePrompt(null);
    setActionError(null);
    recoveryKeyRef.current = null;
  }, [activeSide]);

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

      <div className="home__plan-lists-crossfade">
        <HabitListLayer
          side="light"
          sideData={light}
          isActive={activeSide === "light"}
          focusHabitId={activeSide === "light" ? focusHabitId : null}
          sessionBusy={isBusy}
          onStart={(habit, block) => void handleStart(habit, block)}
        />
        <HabitListLayer
          side="dark"
          sideData={dark}
          isActive={activeSide === "dark"}
          focusHabitId={activeSide === "dark" ? focusHabitId : null}
          sessionBusy={isBusy}
          onStart={(habit, block) => void handleStart(habit, block)}
        />
      </div>

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
        habitName={focusState?.habit.name ?? ""}
        plannedMin={focusState?.plannedMin ?? 0}
        remainingSeconds={timer.remainingSeconds}
        elapsedSeconds={timer.elapsedSeconds}
        isPaused={timer.isPaused}
        canStopEarly={timer.elapsedSeconds >= MIN_STALE_SESSION_SECONDS}
        onTogglePause={timer.togglePause}
        onStopEarly={() => void finishCurrentSession(true)}
      />

      <ValuePrompt
        isOpen={Boolean(valuePrompt)}
        habitName={valuePrompt?.block.habit_name ?? ""}
        unit={valuePrompt?.block.unit ?? "pieces"}
        expectedYield={valuePrompt?.block.expected_yield ?? 0}
        inputLabel={activeSide === "dark" ? "Сколько всего сегодня?" : "Сколько сделал?"}
        isSubmitting={completeSession.isPending}
        onCancel={() => setValuePrompt(null)}
        onSubmit={(value) => {
          if (!valuePrompt) {
            return;
          }

          void (async () => {
            await submitCompletion(
              valuePrompt.habitId,
              valuePrompt.sessionBlockId,
              valuePrompt.isPlanBlock,
              {
                value,
                endedEarly: valuePrompt.endedEarly,
              },
            );
            setValuePrompt(null);
          })();
        }}
      />
    </section>
  );
}
