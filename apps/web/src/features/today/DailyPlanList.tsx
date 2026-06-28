import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DailyPlan, DailyPlanBlock, HabitSessionResponse, TodayDarkHabit, TodayLightHabit, WarmupDay } from "@mytodo/shared";
import { compareLightHabitsForDisplay, isCompanionLightHabit, isNonSessionLightCategory, isStrengthWorkoutHabit, PLANK_PREP_SECONDS } from "@mytodo/shared";
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
import { pauseSession, resumeSession, stopSession } from "../sessions/session-api";
import { useCompleteHabitSession, useStartHabitSession } from "../sessions/useHabitSession";
import { useSessionTimer } from "../sessions/useSessionTimer";
import { needsCompletionValuePrompt, resolveEarlyCompletionValue, resolveNaturalSecondsCompletionValue } from "../sessions/sessionCompletion";
import { formatSessionError } from "../sessions/sessionErrors";
import {
  createFocusBlock,
  resolveSessionPlan,
  type StartSessionOverrides,
} from "../sessions/sessionPlan";
import { useFocusSession } from "../shell/FocusSessionContext";
import { DailyPlanHabitRow } from "./DailyPlanHabitRow";
import { CompanionHabitRow } from "./CompanionHabitRow";
import {
  captureHabitPlanItemRect,
  HabitCompletionFlight,
  type CompletionFlightRect,
} from "./HabitCompletionFlight";
import {
  HABIT_COMPLETION_CELEBRATION_MS,
  HABIT_COMPLETION_FLIGHT_MS,
  waitForHabitCompletion,
} from "./habitCompletionTiming";
import type { TodaySide } from "./useTodayData";

const EMPTY_PLAN: DailyPlan = {
  blocks: [],
  minutes_planned: 0,
  minutes_completed: 0,
  minutes_remaining: 0,
};

export const HOME_COMPLETED_TODAY_SECTION_ID = "home-completed-today";

function isHabitCompletedToday(
  habit: TodayLightHabit | TodayDarkHabit,
  planDate?: string,
): boolean {
  if (habit.checkin?.status !== "success") {
    return false;
  }

  if (planDate) {
    return habit.checkin.date === planDate;
  }

  return true;
}

export type SidePlanData = {
  dailyPlan?: DailyPlan | null;
  habits: (TodayLightHabit | TodayDarkHabit)[];
  planDate?: string;
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
  wakeTime?: string | null;
  timezone?: string | null;
  warmupDay?: WarmupDay | null;
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
  plannedSeconds: number | null;
  startedAt: string | null;
  isPlanBlock: boolean;
  skipPrep: boolean;
  isPaused: boolean;
} | null;

function isPlankSession(habit: TodayLightHabit | TodayDarkHabit, block: DailyPlanBlock): boolean {
  return block.unit === "seconds" || habit.unit === "seconds";
}

function toErrorText(error: unknown): string {
  return formatSessionError(error);
}

function orderHabits(
  habits: (TodayLightHabit | TodayDarkHabit)[],
  blocks: DailyPlanBlock[],
  side: "light" | "dark",
): (TodayLightHabit | TodayDarkHabit)[] {
  if (side === "light") {
    return [...habits].sort((left, right) =>
      compareLightHabitsForDisplay(
        {
          name: left.name,
          template_id: left.template_id,
          category_key: left.category_key,
        },
        {
          name: right.name,
          template_id: right.template_id,
          category_key: right.category_key,
        },
      ),
    );
  }

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
    block:
      block ??
      createFocusBlock(habit, session.planned_min, session.planned_seconds ?? null),
    sessionId: session.id,
    sessionBlockId: session.block_id,
    plannedMin: session.planned_min,
    plannedSeconds: session.planned_seconds ?? null,
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
  isRecoveringSessions: boolean;
  wakeTime?: string | null;
  timezone?: string | null;
  warmupDay?: WarmupDay | null;
  onStart: (
    habit: TodayLightHabit | TodayDarkHabit,
    block: DailyPlanBlock | null,
    overrides?: StartSessionOverrides,
  ) => void;
  onAbortSessionForBookChange: (habitId: string) => Promise<void>;
  completionFlight: { habitId: string; fromRect: CompletionFlightRect | null } | null;
};

function HabitListLayer({
  side,
  sideData,
  isActive,
  focusHabitId,
  sessionBusy,
  backgroundSessions,
  focusElapsedByHabitId,
  isRecoveringSessions,
  wakeTime,
  timezone,
  warmupDay,
  onStart,
  onAbortSessionForBookChange,
  completionFlight,
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
  const orderedHabits = useMemo(
    () => orderHabits(sideData.habits, blocks, side),
    [sideData.habits, blocks, side],
  );

  const { activeHabits, completedHabits } = useMemo(() => {
    const active: (TodayLightHabit | TodayDarkHabit)[] = [];
    const completed: (TodayLightHabit | TodayDarkHabit)[] = [];

    for (const habit of orderedHabits) {
      if (isHabitCompletedToday(habit, sideData.planDate)) {
        completed.push(habit);
      } else {
        active.push(habit);
      }
    }

    return { activeHabits: active, completedHabits: completed };
  }, [orderedHabits]);

  const renderHabitRow = (habit: TodayLightHabit | TodayDarkHabit) => {
    if (isCompanionLightHabit(habit)) {
      return <CompanionHabitRow key={habit.id} habit={habit} />;
    }

    const block = blockByHabitId.get(habit.id) ?? null;
    const hasActiveFocus = focusHabitId === habit.id;

    const habitRow = (
      <DailyPlanHabitRow
        habit={habit}
        block={block}
        side={side}
        planDate={sideData.planDate ?? habit.checkin?.date ?? ""}
        hasActiveFocus={hasActiveFocus}
        resumeSession={backgroundSessions.get(habit.id) ?? null}
        sessionElapsedSeconds={focusElapsedByHabitId.get(habit.id) ?? 0}
        isRecoveringSessions={isRecoveringSessions}
        sessionBusy={sessionBusy}
        focusLocked={Boolean(focusHabitId && !hasActiveFocus)}
        wakeTime={wakeTime}
        timezone={timezone}
        warmupDay={warmupDay}
        onStart={
          habit.type !== "abstinence" &&
          !isNonSessionLightCategory(habit.category_key) &&
          !isStrengthWorkoutHabit(habit)
            ? (overrides) => onStart(habit, block, overrides)
            : undefined
        }
        onAbortSessionForBookChange={onAbortSessionForBookChange}
      />
    );

    if (completionFlight?.habitId === habit.id) {
      return (
        <HabitCompletionFlight key={habit.id} fromRect={completionFlight.fromRect}>
          {habitRow}
        </HabitCompletionFlight>
      );
    }

    return <div key={habit.id}>{habitRow}</div>;
  };

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
        {activeHabits.map((habit) => renderHabitRow(habit))}
        {completedHabits.length > 0 ? (
          <section
            id={isActive ? HOME_COMPLETED_TODAY_SECTION_ID : undefined}
            className="home__plan-completed"
            aria-labelledby={isActive ? "home-completed-today-heading" : undefined}
          >
            <h3
              id={isActive ? "home-completed-today-heading" : undefined}
              className="home__plan-completed-title"
            >
              Выполнено сегодня
            </h3>
            <div className="home__plan-list home__plan-list--completed">
              {completedHabits.map((habit) => renderHabitRow(habit))}
            </div>
          </section>
        ) : null}
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
  wakeTime,
  timezone,
  warmupDay,
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
  const [completionBurst, setCompletionBurst] = useState(false);
  const [completionRetryAvailable, setCompletionRetryAvailable] = useState(false);
  const [completionFlight, setCompletionFlight] = useState<{
    habitId: string;
    fromRect: CompletionFlightRect | null;
  } | null>(null);
  const completionFlightTimeoutRef = useRef<number | null>(null);
  const pendingCompletionFlightRef = useRef<CompletionFlightRect | null>(null);
  const isFinishingSessionRef = useRef(false);
  const autoCompleteFailedSessionRef = useRef<string | null>(null);
  const sessionSyncGenerationRef = useRef(0);
  const { setActive: setFocusSessionActive } = useFocusSession();

  useEffect(() => {
    setFocusSessionActive(Boolean(focusState));
    return () => setFocusSessionActive(false);
  }, [focusState, setFocusSessionActive]);

  const timer = useSessionTimer({
    sessionKey: focusState?.sessionId ?? null,
    plannedMin: focusState?.plannedMin ?? 0,
    plannedSeconds: focusState?.plannedSeconds ?? null,
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
    ): Promise<boolean> => {
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
        await queryClient.refetchQueries({ queryKey: ["today", activeSide] });
        return true;
      } catch (submitError) {
        setActionError(toErrorText(submitError));
        return false;
      }
    },
    [activeSide, completeSession, queryClient],
  );

  const triggerCompletionFlight = useCallback(
    (habitId: string, fromRect: CompletionFlightRect | null) => {
      if (!fromRect || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      if (completionFlightTimeoutRef.current != null) {
        window.clearTimeout(completionFlightTimeoutRef.current);
      }

      setCompletionFlight({ habitId, fromRect });
      completionFlightTimeoutRef.current = window.setTimeout(() => {
        setCompletionFlight(null);
        completionFlightTimeoutRef.current = null;
      }, HABIT_COMPLETION_FLIGHT_MS);
    },
    [],
  );

  useEffect(
    () => () => {
      if (completionFlightTimeoutRef.current != null) {
        window.clearTimeout(completionFlightTimeoutRef.current);
      }
    },
    [],
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
    async (
      habit: TodayLightHabit | TodayDarkHabit,
      block: DailyPlanBlock | null,
      overrides?: StartSessionOverrides,
    ) => {
      if (focusState || startSession.isPending || isEnding || isRecovering) {
        return;
      }

      setActionError(null);
      const plan = resolveSessionPlan(habit, block);
      const plannedMin = overrides?.plannedMin ?? plan.plannedMin;
      const plannedSeconds =
        overrides?.plannedSeconds !== undefined ? overrides.plannedSeconds : plan.plannedSeconds;
      const isPlanBlock = Boolean(block && planBlockIds.has(block.id) && !overrides);

      try {
        if (await openFocusFromSession(habit, block, true)) {
          return;
        }

        const resolvedBlock = overrides
          ? createFocusBlock(habit, plannedMin, plannedSeconds)
          : block ?? createFocusBlock(habit, plannedMin, plannedSeconds);
        setFocusState({
          habit,
          block: resolvedBlock,
          sessionId: null,
          sessionBlockId: isPlanBlock && block ? block.id : null,
          plannedMin,
          plannedSeconds,
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
          ...(focusState.plannedSeconds != null
            ? { planned_seconds: focusState.plannedSeconds }
            : {}),
        },
      });
      const sideData = getSidePlanData(focusState.habit.id, light, dark);
      const habitPlan = getPlan(sideData);
      const habitPlanBlockIds = new Set(habitPlan.blocks.map((item) => item.id));
      const resolvedBlock = resolveBlockForSession(habitPlan, focusState.block, session.block_id);
      setFocusState(buildFocusState(focusState.habit, resolvedBlock, session, habitPlanBlockIds, true));
      autoCompleteFailedSessionRef.current = null;
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
    if (autoCompleteFailedSessionRef.current === closingFocus.sessionId) {
      autoCompleteFailedSessionRef.current = null;
    }
    setCompletionRetryAvailable(false);
    isFinishingSessionRef.current = false;
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
      if (!focusState?.sessionId || isFinishingSessionRef.current) {
        return;
      }

      const elapsedSecondsSnapshot = timer.elapsedSeconds;
      const minNaturalElapsed = Math.min(MIN_STALE_SESSION_SECONDS, timer.totalSeconds);

      if (!endedEarly) {
        if (!timer.isFinished || elapsedSecondsSnapshot < minNaturalElapsed) {
          return;
        }
      } else if (elapsedSecondsSnapshot < MIN_STALE_SESSION_SECONDS) {
        setActionError(`Подождите ещё ${MIN_STALE_SESSION_SECONDS - elapsedSecondsSnapshot} сек`);
        return;
      }

      isFinishingSessionRef.current = true;
      setIsEnding(true);
      const currentFocus = focusState;

      const runNaturalCelebration = async (flightFromRect: CompletionFlightRect | null) => {
        setCompletionBurst(true);
        pendingCompletionFlightRef.current = flightFromRect;
        await waitForHabitCompletion(HABIT_COMPLETION_CELEBRATION_MS);
        setCompletionBurst(false);
      };

      const closeFocusSession = () => {
        setFocusState(null);
        setBackgroundSessions((prev) => {
          const next = new Map(prev);
          next.delete(currentFocus.habit.id);
          return next;
        });
      };

      const releaseFinishLock = () => {
        isFinishingSessionRef.current = false;
        setIsEnding(false);
      };

      try {
        if (endedEarly) {
          autoCompleteFailedSessionRef.current = null;
          setCompletionRetryAvailable(false);
          closeFocusSession();

          if (needsCompletionValuePrompt(currentFocus.habit, currentFocus.block, true)) {
            setValuePrompt({
              habitId: currentFocus.habit.id,
              block: currentFocus.block,
              sessionBlockId: currentFocus.sessionBlockId,
              endedEarly: true,
              isPlanBlock: currentFocus.isPlanBlock,
            });
            return;
          }

          const earlyValue =
            currentFocus.block.unit === "seconds"
              ? Math.max(
                  1,
                  Math.min(
                    elapsedSecondsSnapshot,
                    currentFocus.block.expected_yield > 0
                      ? currentFocus.block.expected_yield
                      : elapsedSecondsSnapshot,
                  ),
                )
              : resolveEarlyCompletionValue(currentFocus.block, currentFocus.plannedMin);

          await submitCompletion(
            currentFocus.habit.id,
            currentFocus.sessionBlockId,
            currentFocus.isPlanBlock,
            {
              value: earlyValue,
              endedEarly: true,
            },
          );
          return;
        }

        const flightFromRect = captureHabitPlanItemRect(currentFocus.habit.id);
        let completed = false;

        if (currentFocus.block.unit === "minutes") {
          completed = await submitCompletion(
            currentFocus.habit.id,
            currentFocus.sessionBlockId,
            currentFocus.isPlanBlock,
            { value: currentFocus.plannedMin, endedEarly },
          );
        } else if (currentFocus.block.unit === "seconds") {
          completed = await submitCompletion(
            currentFocus.habit.id,
            currentFocus.sessionBlockId,
            currentFocus.isPlanBlock,
            {
              value: resolveNaturalSecondsCompletionValue(
                currentFocus.block,
                currentFocus.plannedSeconds,
                elapsedSecondsSnapshot,
              ),
              endedEarly,
            },
          );
        } else {
          pendingCompletionFlightRef.current = flightFromRect;
          closeFocusSession();
          setValuePrompt({
            habitId: currentFocus.habit.id,
            block: currentFocus.block,
            sessionBlockId: currentFocus.sessionBlockId,
            endedEarly,
            isPlanBlock: currentFocus.isPlanBlock,
          });
          return;
        }

        if (!completed) {
          if (elapsedSecondsSnapshot >= minNaturalElapsed) {
            autoCompleteFailedSessionRef.current = currentFocus.sessionId;
            setCompletionRetryAvailable(true);
          }
          return;
        }

        autoCompleteFailedSessionRef.current = null;
        setCompletionRetryAvailable(false);
        await runNaturalCelebration(flightFromRect);
        closeFocusSession();
        triggerCompletionFlight(currentFocus.habit.id, flightFromRect);
        pendingCompletionFlightRef.current = null;
      } finally {
        releaseFinishLock();
      }
    },
    [focusState, submitCompletion, timer.elapsedSeconds, timer.isFinished, timer.totalSeconds, triggerCompletionFlight],
  );

  useEffect(() => {
    if (!focusState?.sessionId || isEnding || isFinishingSessionRef.current || !timer.armed) {
      return;
    }

    const minNaturalElapsed = Math.min(MIN_STALE_SESSION_SECONDS, timer.totalSeconds);
    if (!timer.isFinished || timer.elapsedSeconds < minNaturalElapsed) {
      return;
    }

    if (autoCompleteFailedSessionRef.current === focusState.sessionId) {
      return;
    }

    void finishCurrentSession(false);
  }, [
    finishCurrentSession,
    focusState?.sessionId,
    isEnding,
    timer.armed,
    timer.elapsedSeconds,
    timer.isFinished,
    timer.totalSeconds,
  ]);

  const handleRetryCompletion = useCallback(() => {
    if (!focusState?.sessionId) {
      return;
    }

    autoCompleteFailedSessionRef.current = null;
    setActionError(null);
    void finishCurrentSession(false);
  }, [finishCurrentSession, focusState?.sessionId]);

  const recoverableHabitIds = useMemo(
    () =>
      [
        ...(light.isLoading ? [] : light.habits),
        ...(dark.isLoading ? [] : dark.habits),
      ]
        .filter(
          (habit) =>
            habit.type !== "abstinence" &&
            !isNonSessionLightCategory(habit.category_key) &&
            !isStrengthWorkoutHabit(habit),
        )
        .map((habit) => habit.id)
        .sort()
        .join(","),
    [dark.habits, dark.isLoading, light.habits, light.isLoading],
  );

  const isBusy =
    isRecovering || startSession.isPending || completeSession.isPending || isEnding;
  const focusHabitId = focusState?.habit.id ?? null;

  const abortSessionForBookChange = useCallback(
    async (habitId: string) => {
      let shouldStop = false;

      if (focusState?.habit.id === habitId) {
        setFocusState(null);
        shouldStop = Boolean(focusState.sessionId);
      }

      if (backgroundSessions.has(habitId)) {
        setBackgroundSessions((prev) => {
          const next = new Map(prev);
          next.delete(habitId);
          return next;
        });
        shouldStop = true;
      }

      if (!shouldStop) {
        return;
      }

      try {
        await stopSession(habitId);
        await queryClient.invalidateQueries({ queryKey: ["habit-session-active", habitId] });
        await queryClient.invalidateQueries({ queryKey: ["today", "light"] });
        await queryClient.invalidateQueries({ queryKey: ["today", "dark"] });
      } catch {
        // Сессия могла уже завершиться.
      }
    },
    [backgroundSessions, focusState, queryClient],
  );

  useEffect(() => {
    if (light.isLoading && dark.isLoading) {
      setIsRecovering(false);
      return;
    }

    if (!recoverableHabitIds) {
      setBackgroundSessions(new Map());
      setIsRecovering(false);
      return;
    }

    const generation = ++sessionSyncGenerationRef.current;
    const habitIds = recoverableHabitIds.split(",").filter(Boolean);
    setIsRecovering(true);

    void (async () => {
      try {
        let changed = false;
        const nextBackground = new Map<string, HabitSessionResponse>();

        for (const habitId of habitIds) {
          if (generation !== sessionSyncGenerationRef.current) {
            return;
          }

          try {
            const result = await recoverStaleSession(habitId);
            if (result.status === "stopped") {
              changed = true;
            }
            if (result.status === "kept") {
              const pausedSession = await ensurePausedSession(habitId);
              if (pausedSession) {
                nextBackground.set(habitId, pausedSession);
              }
            }
          } catch {
            // ignore per-habit recovery errors
          }
        }

        if (generation !== sessionSyncGenerationRef.current) {
          return;
        }

        setBackgroundSessions(nextBackground);

        if (changed) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["today", "light"] }),
            queryClient.invalidateQueries({ queryKey: ["today", "dark"] }),
          ]);
        }
      } finally {
        if (generation === sessionSyncGenerationRef.current) {
          setIsRecovering(false);
        }
      }
    })();
  }, [light.isLoading, dark.isLoading, queryClient, recoverableHabitIds]);

  useEffect(() => {
    setFocusState(null);
    setValuePrompt(null);
    setActionError(null);
    setCompletionBurst(false);
    setCompletionFlight(null);
    setCompletionRetryAvailable(false);
    pendingCompletionFlightRef.current = null;
    autoCompleteFailedSessionRef.current = null;
    isFinishingSessionRef.current = false;
    if (completionFlightTimeoutRef.current != null) {
      window.clearTimeout(completionFlightTimeoutRef.current);
      completionFlightTimeoutRef.current = null;
    }
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
          isRecoveringSessions={isRecovering}
          wakeTime={wakeTime}
          timezone={timezone}
          warmupDay={warmupDay}
          onStart={(habit, block, overrides) => void handleStart(habit, block, overrides)}
          onAbortSessionForBookChange={abortSessionForBookChange}
          completionFlight={activeSide === "light" ? completionFlight : null}
        />
        <HabitListLayer
          side="dark"
          sideData={dark}
          isActive={activeSide === "dark"}
          focusHabitId={activeSide === "dark" ? focusHabitId : null}
          sessionBusy={isBusy}
          backgroundSessions={backgroundSessions}
          focusElapsedByHabitId={focusElapsedByHabitId}
          isRecoveringSessions={isRecovering}
          wakeTime={wakeTime}
          timezone={timezone}
          warmupDay={warmupDay}
          onStart={(habit, block, overrides) => void handleStart(habit, block, overrides)}
          onAbortSessionForBookChange={abortSessionForBookChange}
          completionFlight={activeSide === "dark" ? completionFlight : null}
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

      {actionError && !focusState ? <p className="home__task-error">{actionError}</p> : null}

      <FocusScreen
        isOpen={Boolean(focusState)}
        habitName={focusState?.habit.name ?? ""}
        plannedMin={focusState?.plannedMin ?? 0}
        plannedSeconds={focusState?.plannedSeconds ?? null}
        remainingSeconds={
          focusState?.sessionId
            ? timer.remainingSeconds
            : focusState?.plannedSeconds ?? Math.round((focusState?.plannedMin ?? 0) * 60)
        }
        isPaused={timer.isPaused}
        skipPrep={focusState?.skipPrep ?? false}
        autoPrepSeconds={
          focusState && !focusState.skipPrep && isPlankSession(focusState.habit, focusState.block)
            ? PLANK_PREP_SECONDS
            : null
        }
        prepLabel="Встаньте в планку"
        sessionActive={Boolean(focusState?.sessionId)}
        canStopEarly={
          timer.elapsedSeconds >= MIN_STALE_SESSION_SECONDS ||
          (Boolean(focusState?.sessionId) && timer.remainingSeconds <= 0)
        }
        showCompletionBurst={completionBurst}
        errorMessage={actionError}
        showCompletionRetry={
          completionRetryAvailable && !isEnding && !completeSession.isPending
        }
        onRetryCompletion={() => void handleRetryCompletion()}
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
        onCancel={() => {
          pendingCompletionFlightRef.current = null;
          autoCompleteFailedSessionRef.current = null;
          setCompletionRetryAvailable(false);
          setValuePrompt(null);
        }}
        onSubmit={(value) => {
          if (!valuePrompt) {
            return;
          }

          const promptState = valuePrompt;

          void (async () => {
            const completed = await submitCompletion(
              promptState.habitId,
              promptState.sessionBlockId,
              promptState.isPlanBlock,
              {
                value,
                endedEarly: promptState.endedEarly,
              },
            );
            if (completed && !promptState.endedEarly) {
              triggerCompletionFlight(
                promptState.habitId,
                pendingCompletionFlightRef.current,
              );
            }
            pendingCompletionFlightRef.current = null;
            autoCompleteFailedSessionRef.current = null;
            setValuePrompt(null);
          })();
        }}
      />
    </section>
  );
}
