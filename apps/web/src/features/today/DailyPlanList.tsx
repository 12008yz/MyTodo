import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DailyPlan, DailyPlanBlock, HabitSessionResponse, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import { SESSION_TARGET_MIN } from "@mytodo/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ClientApiError } from "../../lib/api";
import { FocusScreen } from "../sessions/FocusScreen";
import { ValuePrompt } from "../sessions/ValuePrompt";
import {
  ensurePausedSession,
  ensureResumedSession,
  getSessionElapsedSeconds,
  isActiveSessionConflict,
  MIN_STALE_SESSION_SECONDS,
  recoverStaleSession,
} from "../sessions/sessionRecovery";
import { pauseSession, resumeSession } from "../sessions/session-api";
import { useCompleteHabitSession, useStartHabitSession } from "../sessions/useHabitSession";
import { useSessionTimer } from "../sessions/useSessionTimer";
import { useFocusSession } from "../shell/FocusSessionContext";
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
  sessionId: string | null;
  sessionBlockId: string | null;
  plannedMin: number;
  startedAt: string | null;
  isPlanBlock: boolean;
  skipPrep: boolean;
  isPaused: boolean;
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

function getSidePlanData(
  habitId: string,
  light: SidePlanData,
  dark: SidePlanData,
): SidePlanData {
  return light.habits.some((habit) => habit.id === habitId) ? light : dark;
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
  skipPrep: boolean,
): FocusState {
  const isPlanBlock = Boolean(session.block_id && planBlockIds.has(session.block_id));

  return {
    habit,
    block: block ?? createFocusBlock(habit, session.planned_min),
    sessionId: session.id,
    sessionBlockId: session.block_id,
    plannedMin: session.planned_min,
    startedAt: session.started_at,
    isPlanBlock,
    skipPrep,
    isPaused: Boolean(session.is_paused),
  };
}

type HabitListLayerProps = {
  side: TodaySide;
  sideData: SidePlanData;
  isActive: boolean;
  focusHabitId: string | null;
  sessionBusy: boolean;
  backgroundSessions: Map<string, HabitSessionResponse>;
  focusElapsedByHabitId: Map<string, number>;
  onStart: (habit: TodayLightHabit | TodayDarkHabit, block: DailyPlanBlock | null) => void;
};

function HabitListLayer({
  side,
  sideData,
  isActive,
  focusHabitId,
  sessionBusy,
  backgroundSessions,
  focusElapsedByHabitId,
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
              resumeSession={backgroundSessions.get(habit.id) ?? null}
              sessionElapsedSeconds={focusElapsedByHabitId.get(habit.id) ?? 0}
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
  const [backgroundSessions, setBackgroundSessions] = useState<Map<string, HabitSessionResponse>>(
    () => new Map(),
  );
  const recoveryKeyRef = useRef<string | null>(null);
  const { setActive: setFocusSessionActive } = useFocusSession();

  useEffect(() => {
    setFocusSessionActive(Boolean(focusState));
    return () => setFocusSessionActive(false);
  }, [focusState, setFocusSessionActive]);

  const timer = useSessionTimer({
    sessionKey: focusState?.sessionId ?? null,
    plannedMin: focusState?.plannedMin ?? 0,
    startedAt: focusState?.startedAt ?? null,
    autoStart: Boolean(focusState?.sessionId && focusState.skipPrep && !focusState.isPaused),
  });

  const focusElapsedByHabitId = useMemo(() => {
    const elapsedByHabit = new Map<string, number>();

    if (focusState?.sessionId) {
      elapsedByHabit.set(focusState.habit.id, timer.elapsedSeconds);
    }

    for (const [habitId, session] of backgroundSessions) {
      elapsedByHabit.set(habitId, getSessionElapsedSeconds(session));
    }

    return elapsedByHabit;
  }, [backgroundSessions, focusState?.habit.id, focusState?.sessionId, timer.elapsedSeconds]);

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

  const syncFocusFromSession = useCallback(
    (session: HabitSessionResponse) => {
      setFocusState((prev) => {
        if (!prev) {
          return null;
        }

        const sideData = getSidePlanData(prev.habit.id, light, dark);
        const habitPlan = getPlan(sideData);
        const habitPlanBlockIds = new Set(habitPlan.blocks.map((item) => item.id));
        const resolvedBlock = resolveBlockForSession(habitPlan, prev.block, session.block_id);
        return buildFocusState(prev.habit, resolvedBlock, session, habitPlanBlockIds, true);
      });
    },
    [dark, light],
  );

  const openFocusFromSession = useCallback(
    async (
      habit: TodayLightHabit | TodayDarkHabit,
      block: DailyPlanBlock | null,
      skipPrep: boolean,
    ): Promise<boolean> => {
      const session = await ensureResumedSession(habit.id);
      if (!session) {
        return false;
      }

      const sideData = getSidePlanData(habit.id, light, dark);
      const habitPlan = getPlan(sideData);
      const habitPlanBlockIds = new Set(habitPlan.blocks.map((item) => item.id));
      const resolvedBlock = resolveBlockForSession(habitPlan, block, session.block_id);
      setFocusState(buildFocusState(habit, resolvedBlock, session, habitPlanBlockIds, skipPrep));
      setBackgroundSessions((prev) => {
        const next = new Map(prev);
        next.delete(habit.id);
        return next;
      });
      return true;
    },
    [dark, light],
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
        if (await openFocusFromSession(habit, block, true)) {
          return;
        }

        const resolvedBlock = block ?? createFocusBlock(habit, plannedMin);
        setFocusState({
          habit,
          block: resolvedBlock,
          sessionId: null,
          sessionBlockId: isPlanBlock && block ? block.id : null,
          plannedMin,
          startedAt: null,
          isPlanBlock,
          skipPrep: false,
          isPaused: false,
        });
      } catch (startError) {
        if (isActiveSessionConflict(startError)) {
          try {
            if (await openFocusFromSession(habit, block, true)) {
              return;
            }
          } catch {
            // fall through to generic error
          }
        }
        setActionError(toErrorText(startError));
      }
    },
    [focusState, isEnding, isRecovering, openFocusFromSession, planBlockIds],
  );

  const handleBeginExercise = useCallback(async () => {
    if (!focusState) {
      return;
    }

    if (focusState.sessionId) {
      setActionError(null);
      try {
        const session = await ensureResumedSession(focusState.habit.id);
        if (session) {
          syncFocusFromSession(session);
          timer.resume();
        }
      } catch (beginError) {
        setActionError(toErrorText(beginError));
      }
      return;
    }

    setActionError(null);

    try {
      const activeSession = await ensureResumedSession(focusState.habit.id);
      if (activeSession) {
        syncFocusFromSession(activeSession);
        setBackgroundSessions((prev) => {
          const next = new Map(prev);
          next.delete(focusState.habit.id);
          return next;
        });
        return;
      }

      const session = await startSession.mutateAsync({
        habitId: focusState.habit.id,
        payload: {
          ...(focusState.isPlanBlock && focusState.sessionBlockId
            ? { block_id: focusState.sessionBlockId }
            : {}),
          planned_min: focusState.plannedMin,
        },
      });
      const sideData = getSidePlanData(focusState.habit.id, light, dark);
      const habitPlan = getPlan(sideData);
      const habitPlanBlockIds = new Set(habitPlan.blocks.map((item) => item.id));
      const resolvedBlock = resolveBlockForSession(habitPlan, focusState.block, session.block_id);
      setFocusState(buildFocusState(focusState.habit, resolvedBlock, session, habitPlanBlockIds, true));
      setBackgroundSessions((prev) => {
        const next = new Map(prev);
        next.delete(focusState.habit.id);
        return next;
      });
    } catch (startError) {
      if (isActiveSessionConflict(startError)) {
        try {
          const activeSession = await ensureResumedSession(focusState.habit.id);
          if (activeSession) {
            syncFocusFromSession(activeSession);
            return;
          }
        } catch {
          // fall through to generic error
        }
      }
      setActionError(toErrorText(startError));
    }
  }, [dark, focusState, light, startSession, syncFocusFromSession, timer]);

  const handleTogglePause = useCallback(async () => {
    if (!focusState?.sessionId) {
      return;
    }

    setActionError(null);

    try {
      if (focusState.isPaused) {
        const session = await resumeSession(focusState.habit.id);
        syncFocusFromSession(session);
        timer.resume();
        return;
      }

      const session = await pauseSession(focusState.habit.id);
      syncFocusFromSession(session);
      timer.pause();
    } catch (toggleError) {
      setActionError(toErrorText(toggleError));
    }
  }, [focusState, syncFocusFromSession, timer]);

  const handleCloseFocus = useCallback(() => {
    if (!focusState || isEnding) {
      return;
    }

    const closingFocus = focusState;
    setFocusState(null);

    if (!closingFocus.sessionId) {
      return;
    }

    void (async () => {
      try {
        const session = await ensurePausedSession(closingFocus.habit.id);
        if (!session) {
          return;
        }

        setBackgroundSessions((prev) => new Map(prev).set(closingFocus.habit.id, session));
      } catch (closeError) {
        setActionError(toErrorText(closeError));
      }
    })();
  }, [focusState, isEnding]);

  const finishCurrentSession = useCallback(
    async (endedEarly: boolean) => {
      if (!focusState?.sessionId || isEnding) {
        return;
      }

      const elapsedForLimit = timer.elapsedSeconds;

      if (endedEarly && elapsedForLimit < MIN_STALE_SESSION_SECONDS) {
        setActionError(`Подождите ещё ${MIN_STALE_SESSION_SECONDS - elapsedForLimit} сек`);
        return;
      }

      setIsEnding(true);
      const elapsedValue = Math.max(timer.elapsedMin, 0);
      const currentFocus = focusState;
      setFocusState(null);
      setBackgroundSessions((prev) => {
        const next = new Map(prev);
        next.delete(currentFocus.habit.id);
        return next;
      });

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
    if (focusState?.sessionId && timer.isFinished && !isEnding) {
      void finishCurrentSession(false);
    }
  }, [finishCurrentSession, focusState?.sessionId, isEnding, timer.isFinished]);

  const recoverableHabitIds = useMemo(
    () =>
      [
        ...(light.isLoading ? [] : light.habits),
        ...(dark.isLoading ? [] : dark.habits),
      ]
        .filter((habit) => habit.type !== "abstinence")
        .map((habit) => habit.id)
        .sort()
        .join(","),
    [dark.habits, dark.isLoading, light.habits, light.isLoading],
  );

  const isBusy =
    isRecovering || startSession.isPending || completeSession.isPending || isEnding;
  const focusHabitId = focusState?.habit.id ?? null;

  useEffect(() => {
    if (light.isLoading && dark.isLoading) {
      return;
    }

    if (recoveryKeyRef.current === recoverableHabitIds) {
      setIsRecovering(false);
      return;
    }
    recoveryKeyRef.current = recoverableHabitIds;

    if (!recoverableHabitIds) {
      setIsRecovering(false);
      return;
    }

    let cancelled = false;
    setIsRecovering(true);

    void (async () => {
      try {
        const habitById = new Map(
          [...light.habits, ...dark.habits].map((habit) => [habit.id, habit] as const),
        );
        let changed = false;

        let nextBackground = new Map<string, HabitSessionResponse>();

        for (const habitId of recoverableHabitIds.split(",")) {
          if (cancelled) {
            return;
          }

          const habit = habitById.get(habitId);
          if (!habit) {
            continue;
          }

          try {
            const result = await recoverStaleSession(habit.id);
            if (result.status === "stopped") {
              changed = true;
            }
            if (result.status === "kept") {
              const pausedSession = await ensurePausedSession(habit.id);
              if (pausedSession) {
                nextBackground.set(habit.id, pausedSession);
              }
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
          setBackgroundSessions(nextBackground);
        }
      } finally {
        if (!cancelled) {
          setIsRecovering(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dark.habits, dark.isLoading, light.habits, light.isLoading, queryClient, recoverableHabitIds]);

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
          backgroundSessions={backgroundSessions}
          focusElapsedByHabitId={focusElapsedByHabitId}
          onStart={(habit, block) => void handleStart(habit, block)}
        />
        <HabitListLayer
          side="dark"
          sideData={dark}
          isActive={activeSide === "dark"}
          focusHabitId={activeSide === "dark" ? focusHabitId : null}
          sessionBusy={isBusy}
          backgroundSessions={backgroundSessions}
          focusElapsedByHabitId={focusElapsedByHabitId}
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
        remainingSeconds={
          focusState?.sessionId
            ? timer.remainingSeconds
            : Math.round((focusState?.plannedMin ?? 0) * 60)
        }
        elapsedSeconds={focusState?.sessionId ? timer.elapsedSeconds : 0}
        isPaused={timer.isPaused}
        skipPrep={focusState?.skipPrep ?? false}
        canStopEarly={timer.elapsedSeconds >= MIN_STALE_SESSION_SECONDS}
        onBeginSession={() => void handleBeginExercise()}
        onTogglePause={() => void handleTogglePause()}
        onStopEarly={() => void finishCurrentSession(true)}
        onClose={() => void handleCloseFocus()}
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
