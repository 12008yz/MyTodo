import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { DailyPlanBlock, HabitReadingProgress, HabitSessionResponse, TodayDarkHabit, TodayLightHabit, WarmupDay } from "@mytodo/shared";
import {
  isEarlyRiseCategoryKey,
  isMeditationHabit,
  isForeignLanguageHabit,
  isNonSessionLightCategory,
  isPlankHabit,
  isWarmupHabit,
  isStrengthWorkoutHabit,
  isCoachEligibleDarkHabit,
  darkReductionDots,
  formatSocialMediaRemainingMinutes,
  resolveStrengthProgressionLevel,
  strengthRepsPerExercise,
  STRENGTH_WORKOUT_REPS_PER_ROUND,
  STRETCH_TARGET_MINUTES,
} from "@mytodo/shared";
import { isWeekendDate } from "@mytodo/domain";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { resetBooksHabitOnToday } from "../../features/books/bookTodayCache";
import { ClientApiError, clearHabitBook, getEnglishToday, selectHabitBook, startDoomScroll, stopDoomScroll } from "../../lib/api";
import { CollapsibleReveal } from "../../components/CollapsibleReveal";
import { BookPickerModal } from "./BookPickerModal";
import {
  bookFromReading,
  getBookPageCount,
  type SelectedBook,
} from "./bookSelection";
import {
  bookPagesRemainingFromPosition,
  pagesReadTodayFromProgress,
} from "../books/bookReadingProgress";
import { formatBookReadingMinutesLabel, formatBooksDailyProgressLabel } from "../books/bookReadingTimer";
import {
  buildHabitBookEstimate,
  formatBookFinishedLabel,
  formatHabitBookRemainingTime,
} from "./bookReadingPlan";
import {
  formatCardHint,
  formatGoalLabel,
  formatSessionDuration,
  formatSmokingRemainingLabel,
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
import { ExtraSessionModal } from "../sessions/ExtraSessionModal";
import { ValuePrompt } from "../sessions/ValuePrompt";
import { getSessionElapsedSeconds, getSessionRemainingSeconds } from "../sessions/sessionRecovery";
import {
  formatExtraSessionDuration,
  resolveSessionPlan,
  type StartSessionOverrides,
} from "../sessions/sessionPlan";
import { isBooksHabit } from "./isBooksHabit";
import { StrengthWorkoutCircuit, clearStrengthCircuitStorage, countStrengthCircuitExercisesDone, isStrengthCircuitRoundComplete } from "./StrengthWorkoutCircuit";
import { PlankTechniqueDemo } from "./PlankTechniqueDemo";
import { WarmupTechniqueDemo } from "./WarmupTechniqueDemo";
import { MeditationGuide } from "./MeditationGuide";
import { EnglishLessonDrawer } from "./EnglishLessonDrawer";
import { DarkCoachSheet } from "../coach/DarkCoachSheet";
import { DoomScrollAppPicker } from "../doom-scroll/DoomScrollAppPicker";
import { formatDoomScrollCountdown, useDoomScrollCountdown } from "../doom-scroll/useDoomScrollCountdown";
import type { DoomScrollPlatform } from "@mytodo/shared";
import { stopVkEmbedsInContainer } from "../english/vk-api";
import { clearEnglishLessonManualMinutes, readEnglishLessonManualMinutes, resolveEnglishCardMinutes } from "../english/englishLessonManual";
import {
  resolveEnglishHabitGoalMinutes,
  resolveEnglishLessonDuration,
} from "../english/format";
import { englishQueryKeys } from "../english/useEnglish";
import { prefetchExerciseMedia } from "../../lib/exercise-media";
import { useEarlyRiseWindow } from "./useEarlyRiseWindow";

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
  planDate: string;
  hasActiveFocus: boolean;
  resumeSession: HabitSessionResponse | null;
  sessionElapsedSeconds: number;
  isRecoveringSessions: boolean;
  sessionBusy: boolean;
  focusLocked: boolean;
  wakeTime?: string | null;
  timezone?: string | null;
  warmupDay?: WarmupDay | null;
  onStart?: (overrides?: StartSessionOverrides) => void;
  onAbortSessionForBookChange?: (habitId: string) => Promise<void>;
};

function formatSessionCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function hasTimerField(habit: TodayLightHabit | TodayDarkHabit): habit is TodayDarkHabit {
  return "timer" in habit;
}

function habitReading(
  habit: TodayLightHabit | TodayDarkHabit,
): HabitReadingProgress | null | undefined {
  return "reading" in habit ? habit.reading : null;
}

function resolveBadge(
  habit: TodayLightHabit | TodayDarkHabit,
  _block: DailyPlanBlock | null,
  options?: {
    earlyRiseEnforcementActive?: boolean;
    warmupDayActive?: boolean;
    earlyRiseWeekendRest?: boolean;
    goalReached?: boolean;
  },
): { label: string; className: string } {
  const status = habit.checkin?.status;

  if (options?.goalReached) {
    return { label: statusLabel("success", habit.type), className: "home__plan-badge--completed" };
  }

  if (status === "success") {
    return { label: statusLabel(status, habit.type), className: "home__plan-badge--completed" };
  }

  if (status === "skipped" && options?.earlyRiseWeekendRest) {
    return { label: "Выходной", className: "home__plan-badge--completed" };
  }

  if (status === "fail") {
    if (
      isEarlyRiseCategoryKey(habit.category_key) &&
      (options?.earlyRiseEnforcementActive === false || options?.warmupDayActive)
    ) {
      return { label: statusLabel(undefined, habit.type), className: "home__plan-badge--pending" };
    }
    if (isEarlyRiseCategoryKey(habit.category_key)) {
      return { label: "GG", className: "home__plan-badge--fail" };
    }
    return { label: statusLabel(status, habit.type), className: "home__plan-badge--fail" };
  }

  if (status === "skipped") {
    return { label: statusLabel(status, habit.type), className: "home__plan-badge--pending" };
  }

  if (options?.warmupDayActive && !options?.earlyRiseEnforcementActive) {
    return { label: "Разгон", className: "home__plan-badge--warmup" };
  }

  return { label: statusLabel(status, habit.type), className: "home__plan-badge--pending" };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, a, input, label, .home__strength-circuit, .home__plank-technique-wrap, .home__plank-technique, .home__warmup-technique-wrap, .home__warmup-technique, .home__english-lesson, .home__english-lesson-player, video, iframe"))
  );
}

export function DailyPlanHabitRow({
  habit,
  block,
  side,
  planDate,
  hasActiveFocus,
  resumeSession,
  sessionElapsedSeconds,
  isRecoveringSessions,
  sessionBusy,
  focusLocked,
  wakeTime,
  timezone,
  warmupDay,
  onStart,
  onAbortSessionForBookChange,
}: DailyPlanHabitRowProps) {
  const checkinMutation = useCheckinMutation(side);
  const queryClient = useQueryClient();
  const doomScrollMutation = useMutation({
    mutationFn: (platform: DoomScrollPlatform) => startDoomScroll(habit.id, { platform }),
    onSuccess: async () => {
      setDoomPickerOpen(false);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["today", side] });
    },
    onError: (err) => {
      setActionError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось начать сессию",
      );
    },
  });
  const stopDoomMutation = useMutation({
    mutationFn: () => stopDoomScroll(habit.id),
    onSuccess: async (result) => {
      setActionError(null);
      setDoomNotice(`Сессия завершена · +${result.minutes_added} мин`);
      await queryClient.invalidateQueries({ queryKey: ["today", side] });
    },
    onError: (err) => {
      setActionError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось завершить сессию",
      );
    },
  });
  const doomBusy = doomScrollMutation.isPending || stopDoomMutation.isPending;
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedLook, setExpandedLook] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [darkValueOpen, setDarkValueOpen] = useState(false);
  const [doomPickerOpen, setDoomPickerOpen] = useState(false);
  const [doomNotice, setDoomNotice] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<SelectedBook | null>(null);
  const status = habit.checkin?.status;
  const currentValue = habit.checkin?.value ?? 0;
  const isSocialMedia = side === "dark" && habit.template_id === "social_media";
  const doomSession =
    isSocialMedia && "doom_scroll_active" in habit ? habit.doom_scroll_active : null;
  const doomCountdownSec = useDoomScrollCountdown(doomSession);
  const socialMediaMinutesLeft = Math.max(0, habit.current_goal - Math.floor(currentValue));
  const nextSessionMinutes = Math.min(15, socialMediaMinutesLeft);
  const showCoachButton = side === "dark" && isCoachEligibleDarkHabit(habit.template_id);
  const isSmoking =
    side === "dark" &&
    habit.template_id === "smoking" &&
    habit.type === "limit" &&
    habit.phase === "reduction" &&
    habit.current_goal > 0;
  const showDarkValueLog =
    side === "dark" &&
    habit.type === "limit" &&
    habit.template_id !== "smoking" &&
    habit.template_id !== "social_media";
  const showReductionTrack =
    side === "dark" &&
    habit.type === "limit" &&
    habit.progression_interval_days > 1;
  const isBooks = isBooksHabit(habit);
  const isStrengthWorkout = isStrengthWorkoutHabit(habit);
  const isPlank = isPlankHabit(habit);
  const isWarmup = isWarmupHabit(habit);
  const isMeditation = isMeditationHabit(habit);
  const isForeignLanguage = isForeignLanguageHabit(habit);
  const { data: englishToday } = useQuery({
    queryKey: englishQueryKeys.today,
    queryFn: getEnglishToday,
    enabled: isForeignLanguage,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const strengthReps = strengthRepsPerExercise(
    resolveStrengthProgressionLevel(habit.baseline_value, habit.current_goal),
  );
  const reading = habitReading(habit);
  const isEarlyRise = isEarlyRiseCategoryKey(habit.category_key);
  const isEarlyRiseWeekendRest = isEarlyRise && Boolean(planDate && isWeekendDate(planDate));
  const warmupDayActive = warmupDay?.active === true;
  const earlyRiseEnforcementActive =
    isEarlyRise &&
    !isEarlyRiseWeekendRest &&
    warmupDay !== undefined &&
    (!warmupDayActive || warmupDay.early_rise_enforcement === true);
  const earlyRiseWindow = useEarlyRiseWindow({
    enabled:
      earlyRiseEnforcementActive &&
      status !== "success" &&
      status !== "skipped" &&
      status !== "fail",
    wakeTime,
    shiftMinutes: habit.current_goal,
    timezone,
  });
  const isNonSessionHabit = isNonSessionLightCategory(habit.category_key);
  const selectedBookPageCount =
    reading?.page_count ?? (selectedBook ? getBookPageCount(selectedBook.id) : null);
  const todayPagesRead =
    isBooks && reading && planDate ? pagesReadTodayFromProgress(reading, planDate) : 0;
  const pagesLeftInBook =
    isBooks && reading && selectedBookPageCount != null
      ? bookPagesRemainingFromPosition(reading.last_read_page, selectedBookPageCount)
      : null;
  const selectedBookRemainingEstimate =
    pagesLeftInBook != null && pagesLeftInBook > 0
      ? buildHabitBookEstimate({
          pageCount: pagesLeftInBook,
          currentGoal: habit.current_goal,
          growthStep: habit.growth_step,
          intervalDays: habit.progression_interval_days,
          successDaysAtGoal: habit.success_days_at_goal,
        })
      : null;
  const isBookFinished =
    isBooks &&
    selectedBook &&
    selectedBookPageCount != null &&
    reading != null &&
    (reading.completed_at != null || reading.last_read_page >= selectedBookPageCount);

  useEffect(() => {
    if (!isBooks) {
      setSelectedBook(null);
      return;
    }
    setSelectedBook(bookFromReading(reading));
  }, [habit.id, reading, isBooks]);

  useEffect(() => {
    if ((isStrengthWorkout || isPlank || isWarmup) && expanded) {
      prefetchExerciseMedia();
    }
  }, [expanded, isStrengthWorkout, isPlank, isWarmup]);

  const isPending = checkinMutation.isPending;
  const timer = hasTimerField(habit) ? habit.timer : null;
  const englishLessonComplete =
    isForeignLanguage &&
    englishToday?.enabled === true &&
    englishToday.day_status === "success";
  const timerComplete =
    isForeignLanguage
      ? status === "success"
      : status === "success" || currentValue >= habit.current_goal;
  const goalReached = isForeignLanguage
    ? timerComplete || englishLessonComplete
    : status === "success";
  const reductionDots = showReductionTrack
    ? darkReductionDots(
        habit.success_days_at_goal,
        habit.progression_interval_days,
        goalReached,
      )
    : [];
  const showAsCompleted = goalReached && !(isForeignLanguage && expanded);
  const canStartSession =
    !isNonSessionHabit &&
    !isStrengthWorkout &&
    habit.type !== "abstinence" &&
    Boolean(onStart);
  const isExtraSessionMode =
    goalReached && canStartSession && !hasActiveFocus && !resumeSession && !isRecoveringSessions && block?.status !== "active";
  const defaultExtraSessionPlan = useMemo(
    () => resolveSessionPlan(habit, block),
    [habit, block],
  );
  const startDurationLabel = formatExtraSessionDuration(defaultExtraSessionPlan, habit.unit);
  const [extraSessionOpen, setExtraSessionOpen] = useState(false);
  const [strengthResetKey, setStrengthResetKey] = useState(0);
  const [strengthExercisesDone, setStrengthExercisesDone] = useState(() =>
    isStrengthWorkout
      ? countStrengthCircuitExercisesDone(habit.id, planDate, strengthReps)
      : 0,
  );
  const [strengthRoundComplete, setStrengthRoundComplete] = useState(() =>
    isStrengthWorkout ? isStrengthCircuitRoundComplete(habit.id, planDate, strengthReps) : false,
  );
  const [englishPlayerOpen, setEnglishPlayerOpen] = useState(false);
  const [lessonWatchMinutes, setLessonWatchMinutes] = useState(0);
  const [lessonManualMinutes, setLessonManualMinutes] = useState(0);
  const habitCardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isStrengthWorkout) {
      setStrengthRoundComplete(false);
      setStrengthExercisesDone(0);
      return;
    }

    setStrengthRoundComplete(isStrengthCircuitRoundComplete(habit.id, planDate, strengthReps));
    setStrengthExercisesDone(countStrengthCircuitExercisesDone(habit.id, planDate, strengthReps));
  }, [habit.id, planDate, isStrengthWorkout, strengthResetKey, currentValue, strengthReps]);

  useEffect(() => {
    if (expanded) {
      setExpandedLook(true);
    }
  }, [expanded]);

  const handleStrengthExercisesClick = () => {
    if (strengthRoundComplete) {
      clearStrengthCircuitStorage(habit.id, planDate);
      setStrengthResetKey((key) => key + 1);
      setStrengthRoundComplete(false);
      setStrengthExercisesDone(0);
    }
    setExpanded(true);
  };

  useEffect(() => {
    if (!expanded && englishPlayerOpen) {
      setEnglishPlayerOpen(false);
    }
  }, [expanded, englishPlayerOpen]);

  useEffect(() => {
    if (!isForeignLanguage) {
      return;
    }
    if (!expanded || !englishPlayerOpen) {
      stopVkEmbedsInContainer(habitCardRef.current);
    }
  }, [expanded, englishPlayerOpen, isForeignLanguage]);

  const englishLessonKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isForeignLanguage || !englishToday?.enabled) {
      return;
    }

    const lessonKey = `${englishToday.lesson.id}:${englishToday.day_status ?? "open"}`;
    if (englishLessonKeyRef.current === lessonKey) {
      return;
    }

    englishLessonKeyRef.current = lessonKey;
    const lessonSucceeded = englishToday.day_status === "success";

    if (lessonSucceeded) {
      clearEnglishLessonManualMinutes(planDate, englishToday.lesson.id);
    }
  }, [
    englishToday,
    isForeignLanguage,
    planDate,
  ]);

  const englishLessonIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isForeignLanguage || !englishToday?.enabled) {
      englishLessonIdRef.current = null;
      return;
    }

    const nextLessonId = englishToday.lesson.id;
    if (englishLessonIdRef.current === nextLessonId) {
      return;
    }

    const hadPreviousLesson = englishLessonIdRef.current != null;
    englishLessonIdRef.current = nextLessonId;

    const lessonMinutes = Math.ceil(englishToday.watched_sec / 60);
    setLessonWatchMinutes(lessonMinutes);
    setLessonManualMinutes(readEnglishLessonManualMinutes(planDate, nextLessonId));

    if (hadPreviousLesson) {
      setEnglishPlayerOpen(false);
      englishLessonKeyRef.current = null;
    }
  }, [englishToday, habit.current_goal, isForeignLanguage, planDate]);

  const startDisabled =
    sessionBusy || focusLocked || hasActiveFocus || !canStartSession;
  const canQuickAdd =
    habit.type === "target" &&
    status !== "skipped" &&
    !isNonSessionHabit &&
    !isStrengthWorkout &&
    !isForeignLanguage;
  const sessionProgress = getLiveSessionProgress(habit.unit, sessionElapsedSeconds);
  const hasSessionProgress = sessionProgress > 0;
  const booksSessionPages =
    isBooks && hasSessionProgress
      ? currentValue + getLiveSessionProgressLabel(habit.unit, sessionElapsedSeconds)
      : 0;
  const booksDailyProgress = isBooks
    ? Math.max(currentValue, todayPagesRead, booksSessionPages)
    : currentValue;
  const pausedSessionMinutes =
    isForeignLanguage && resumeSession
      ? Math.floor(getSessionElapsedSeconds(resumeSession) / 60)
      : 0;
  const timerProgressValue = isForeignLanguage
    ? Math.min(
        habit.current_goal,
        currentValue + (hasSessionProgress ? sessionProgress : pausedSessionMinutes),
      )
    : 0;
  const englishVideoMinutes =
    isForeignLanguage && englishToday?.enabled === true
      ? Math.max(
          lessonWatchMinutes,
          resolveEnglishHabitGoalMinutes(
            englishToday.watched_sec,
            resolveEnglishLessonDuration(englishToday.lesson.duration_sec, null),
            habit.current_goal,
            englishToday.day_status === "success",
          ),
        )
      : 0;
  const englishCardMinutes =
    isForeignLanguage && englishToday?.enabled === true
      ? resolveEnglishCardMinutes(
          englishVideoMinutes,
          lessonManualMinutes,
          habit.current_goal,
        )
      : 0;
  const foreignLanguageProgressValue = isForeignLanguage
    ? Math.min(habit.current_goal, Math.max(timerProgressValue, englishCardMinutes))
    : 0;
  const progressValue = isForeignLanguage
    ? foreignLanguageProgressValue
    : hasSessionProgress
      ? currentValue + sessionProgress
      : currentValue;
  const effectiveProgressValue = isBooks ? booksDailyProgress : progressValue;
  const effectiveProgressPercent =
    habit.type !== "abstinence" && habit.current_goal > 0
      ? Math.min(100, (effectiveProgressValue / habit.current_goal) * 100)
      : 0;
  const progressPercent =
    habit.type !== "abstinence" && habit.current_goal > 0
      ? Math.min(100, (progressValue / habit.current_goal) * 100)
      : 0;
  const strengthProgressPercent = goalReached
    ? 100
    : Math.min(100, (strengthExercisesDone / STRENGTH_WORKOUT_REPS_PER_ROUND) * 100);
  const displayProgressPercent = isStrengthWorkout
    ? strengthProgressPercent
    : isBooks
      ? effectiveProgressPercent
      : progressPercent;
  const displayProgressValue = isStrengthWorkout
    ? goalReached
      ? STRENGTH_WORKOUT_REPS_PER_ROUND
      : strengthExercisesDone
    : isBooks
      ? effectiveProgressValue
      : progressValue;
  const progressLabelValue = isBooks
    ? String(booksDailyProgress)
    : isForeignLanguage
      ? habit.unit === "minutes" && foreignLanguageProgressValue < 10
        ? foreignLanguageProgressValue.toFixed(1)
        : String(Math.floor(foreignLanguageProgressValue))
    : hasSessionProgress
      ? habit.unit === "minutes" && progressValue < 10
        ? progressValue.toFixed(1)
        : String(
            Math.floor(
              currentValue + getLiveSessionProgressLabel(habit.unit, sessionElapsedSeconds),
            ),
          )
      : habit.unit === "minutes" && progressValue < 10
        ? progressValue.toFixed(1)
        : String(Math.floor(currentValue));
  const strengthProgressLabel = `${displayProgressValue} / ${STRENGTH_WORKOUT_REPS_PER_ROUND} упражн.`;
  const progressLabelText = isStrengthWorkout
    ? strengthProgressLabel
    : isBooks
      ? formatBooksDailyProgressLabel(booksDailyProgress, habit.current_goal)
      : isSmoking
        ? formatSmokingRemainingLabel(currentValue, habit.current_goal)
      : isSocialMedia
        ? formatSocialMediaRemainingMinutes(currentValue, habit.current_goal)
      : `${progressLabelValue} / ${habit.current_goal} ${formatUnit(habit.unit)}`;
  const cardHint = isEarlyRise
    ? null
    : isSocialMedia && doomSession
      ? {
          text: `Сессия · осталось ${formatDoomScrollCountdown(doomCountdownSec)}`,
          variant: "hint" as const,
        }
      : isSocialMedia && doomNotice
        ? { text: doomNotice, variant: "success" as const }
        : isSocialMedia && socialMediaMinutesLeft <= 0
          ? { text: "Лимит на сегодня исчерпан", variant: "hint" as const }
    : isStrengthWorkout && !goalReached
    ? { text: "Нажмите «Упражнения»", variant: "hint" as const }
    : formatCardHint({
        habit,
        block,
        goalReached,
        resumeSession: Boolean(resumeSession),
        hasActiveFocus,
        wakeTime,
      });

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

  const earlyRiseFailSentRef = useRef(false);
  const doomExpiredRef = useRef(false);

  useEffect(() => {
    earlyRiseFailSentRef.current = false;
  }, [habit.id, planDate]);

  useEffect(() => {
    doomExpiredRef.current = false;
  }, [habit.id, doomSession?.id]);

  useEffect(() => {
    if (!doomSession || doomCountdownSec > 0) {
      return;
    }
    if (doomExpiredRef.current) {
      return;
    }
    doomExpiredRef.current = true;
    void queryClient.invalidateQueries({ queryKey: ["today", side] });
  }, [doomSession, doomCountdownSec, queryClient, side]);

  useEffect(() => {
    if (!doomNotice) {
      return;
    }
    const id = window.setTimeout(() => setDoomNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [doomNotice]);

  useEffect(() => {
    if (
      !isEarlyRise ||
      !earlyRiseEnforcementActive ||
      !earlyRiseWindow ||
      status === "success" ||
      status === "fail" ||
      status === "skipped" ||
      earlyRiseWindow.phase !== "expired" ||
      earlyRiseFailSentRef.current
    ) {
      return;
    }

    earlyRiseFailSentRef.current = true;
    void runCheckin({ habit_id: habit.id, status: "fail" });
  }, [isEarlyRise, earlyRiseEnforcementActive, earlyRiseWindow?.phase, status, habit.id, planDate]);

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

  const handleSmokedCigarette = () => {
    void runCheckin({ habit_id: habit.id, value: currentValue + 1 });
  };

  const handleBookSelect = async (book: SelectedBook | null) => {
    if (book === null) {
      setActionError(null);
      try {
        await onAbortSessionForBookChange?.(habit.id);
        await clearHabitBook(habit.id);
        resetBooksHabitOnToday(queryClient, habit.id, null);
        await queryClient.invalidateQueries({ queryKey: ["today", side] });
        setSelectedBook(null);
      } catch (err) {
        setActionError(
          err instanceof ClientApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Не удалось снять выбор",
        );
      }
      return;
    }

    if (selectedBook?.id === book.id) {
      return;
    }

    setActionError(null);
    try {
      if (isBooks && selectedBook) {
        await onAbortSessionForBookChange?.(habit.id);
      }
      const reading = await selectHabitBook(habit.id, {
        book_id: book.id,
        ...(isBooks && selectedBook ? { checkin_baseline: 0 } : {}),
      });
      resetBooksHabitOnToday(queryClient, habit.id, reading);
      await queryClient.invalidateQueries({ queryKey: ["today", side] });
      setSelectedBook(book);
    } catch (err) {
      setActionError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось сменить книгу",
      );
    }
  };

  const booksNeedsNewBook = isBooks && isBookFinished;
  const opensBookReader =
    isBooks && Boolean(reading?.book_id ?? selectedBook?.id) && !booksNeedsNewBook;
  const booksStartLabel = booksNeedsNewBook
    ? "Сменить книгу"
    : reading && reading.last_read_page > 1
      ? `Продолжить · стр. ${reading.last_read_page}`
      : "Читать";

  const handleStartClick = () => {
    if (booksNeedsNewBook) {
      setBookPickerOpen(true);
      return;
    }

    if (isExtraSessionMode && !opensBookReader) {
      setExtraSessionOpen(true);
      return;
    }

    if (opensBookReader && !hasActiveFocus && !resumeSession) {
      navigate(`/habits/${habit.id}/read`);
      return;
    }

    onStart?.();
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
      : resolveBadge(habit, block, {
          earlyRiseEnforcementActive,
          warmupDayActive,
          earlyRiseWeekendRest: isEarlyRiseWeekendRest && status === "skipped",
          goalReached,
        });

  const startLabel = hasActiveFocus
    ? "Идёт фокус"
    : resumeSession
      ? `Продолжить · ${formatSessionCountdown(getSessionRemainingSeconds(resumeSession))}`
      : isRecoveringSessions && block?.status === "active"
        ? "Продолжить..."
      : block?.status === "active"
      ? `Продолжить · ${formatSessionDuration(block)}`
      : booksNeedsNewBook
        ? "Сменить книгу"
      : opensBookReader
        ? booksStartLabel
      : goalReached
      ? "Ещё сессия"
      : block
        ? `Начать · ${startDurationLabel}`
        : "Начать";

  const quickAddChips =
    habit.unit === "minutes" ? [5, 10, 15] : habit.unit === "pages" ? [1, 2, 5] : [];

  return (
    <>
      <article
        ref={habitCardRef}
        data-habit-plan-item={habit.id}
        className={[
          "home__plan-item",
          expandedLook ? "home__plan-item--expanded" : "",
          hasActiveFocus ? "home__plan-item--focus-active" : "",
          resumeSession ? "home__plan-item--session-paused" : "",
          showAsCompleted ? "home__plan-item--completed" : "",
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
        <header className="home__plan-item-header">
          <h3 className="home__plan-item-title">
            <HabitIcon
              icon={habit.icon ?? block?.icon}
              side={side}
              template_id={habit.template_id}
              category_key={habit.category_key}
              name={habit.name}
            />
            <span className="home__plan-item-name">{habit.name}</span>
          </h3>
          <span className={["home__plan-badge", badge.className].join(" ")}>{badge.label}</span>
        </header>

        <p className="home__plan-item-goal">{formatGoalLabel(habit, wakeTime, planDate)}</p>

        {timer ? (
          <p className="home__task-timer">Чистое время: {formatTimer(timer.elapsed)}</p>
        ) : null}

        {showReductionTrack ? (
          <div className="home__dark-reduction" aria-label="Прогресс к снижению лимита">
            {reductionDots.map((dot, index) => (
              <span
                key={index}
                className={[
                  "home__dark-reduction-dot",
                  dot === "done" ? "home__dark-reduction-dot--done" : "",
                  dot === "current" ? "home__dark-reduction-dot--current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </div>
        ) : null}

        {!timer && habit.type !== "abstinence" && !isNonSessionHabit ? (
          <div className="home__plan-item-progress">
            <div
              className="home__plan-item-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={isStrengthWorkout ? STRENGTH_WORKOUT_REPS_PER_ROUND : habit.current_goal}
              aria-valuenow={Math.floor(displayProgressValue)}
            >
              <span
                className="home__plan-item-progress-fill"
                style={{ width: `${displayProgressPercent}%` }}
              />
            </div>
            <p className="home__task-progress">
              {progressLabelText}
              {isBooks && reading ? ` · стр. ${reading.last_read_page}` : ""}
            </p>
          </div>
        ) : null}

        {cardHint ? (
          <p
            className={[
              "home__plan-item-hint",
              cardHint.variant === "success" ? "home__plan-item-hint--success" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {cardHint.text}
          </p>
        ) : null}

        <div className="home__task-actions">
          {isStrengthWorkout ? (
            <button
              type="button"
              className="home__task-btn home__task-btn--start"
              disabled={isPending || sessionBusy}
              onClick={(event) => {
                event.stopPropagation();
                handleStrengthExercisesClick();
              }}
            >
              {strengthRoundComplete ? "Ещё круг" : "Упражнения"}
            </button>
          ) : null}

          {canStartSession ? (
            <button
              type="button"
              className="home__task-btn home__task-btn--start"
              disabled={startDisabled}
              onClick={(event) => {
                event.stopPropagation();
                handleStartClick();
              }}
            >
              {startLabel}
            </button>
          ) : null}

          {isEarlyRise &&
          earlyRiseEnforcementActive &&
          wakeTime &&
          status !== "success" &&
          status !== "skipped" &&
          status !== "fail" ? (
            <button
              type="button"
              className="home__task-btn home__task-btn--start"
              disabled={
                isPending ||
                sessionBusy ||
                !earlyRiseWindow ||
                earlyRiseWindow.phase !== "window"
              }
              onClick={(event) => {
                event.stopPropagation();
                void runCheckin({
                  habit_id: habit.id,
                  value: habit.current_goal,
                });
              }}
            >
              {earlyRiseWindow?.phase === "before"
                ? `Ждём ${earlyRiseWindow.target_wake_time}`
                : "Я проснулся"}
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

          {isSmoking ? (
            <button
              type="button"
              className="home__task-btn home__task-btn--start"
              disabled={isPending || sessionBusy}
              onClick={(event) => {
                event.stopPropagation();
                handleSmokedCigarette();
              }}
            >
              Покурил сигарету
            </button>
          ) : null}

          {isSocialMedia ? (
            doomSession ? (
              <button
                type="button"
                className="home__task-btn home__task-btn--start"
                disabled={isPending || doomBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  void stopDoomMutation.mutateAsync();
                }}
              >
                Закончил · {formatDoomScrollCountdown(doomCountdownSec)}
              </button>
            ) : (
              <button
                type="button"
                className="home__task-btn home__task-btn--start"
                disabled={isPending || doomBusy || socialMediaMinutesLeft <= 0}
                onClick={(event) => {
                  event.stopPropagation();
                  setDoomPickerOpen(true);
                }}
              >
                {nextSessionMinutes < 15
                  ? `Начать · ${nextSessionMinutes} мин`
                  : "Начать · 15 мин"}
              </button>
            )
          ) : null}

          {showDarkValueLog ? (
            <button
              type="button"
              className="home__task-btn home__task-btn--start"
              disabled={isPending || sessionBusy}
              onClick={(event) => {
                event.stopPropagation();
                setDarkValueOpen(true);
              }}
            >
              Записать
            </button>
          ) : null}

          {showCoachButton ? (
            <button
              type="button"
              className="home__task-btn home__task-btn--coach"
              disabled={isPending || sessionBusy}
              onClick={(event) => {
                event.stopPropagation();
                setCoachOpen(true);
              }}
            >
              Поговорить
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

        <CollapsibleReveal
          open={expanded}
          scrollBehavior="none"
          onCollapsed={() => {
            setExpandedLook(false);
            setEnglishPlayerOpen(false);
          }}
          className="home__plan-item-drawer"
          contentClassName="home__plan-item-drawer-inner"
        >
          <div className="home__plan-item-drawer-body">
            <p className="home__plan-item-drawer-title">
              <PlanInfoIcon className="home__plan-item-drawer-icon" />
              {isStrengthWorkout ? "Круговая тренировка" : "Подробнее"}
            </p>
            {isMeditation ? (
              <MeditationGuide />
            ) : isForeignLanguage ? (
              <EnglishLessonDrawer
                expanded={expanded}
                playerOpen={englishPlayerOpen}
                onPlayerOpenChange={setEnglishPlayerOpen}
                goalMinutes={habit.current_goal}
                onWatchMinutesChange={setLessonWatchMinutes}
                onLessonComplete={() => setExpanded(true)}
              />
            ) : isStrengthWorkout ? (
              <p className="home__plan-item-drawer-text home__strength-circuit-intro">
                Каждое упражнение — по {strengthReps} раз. Со временем будем увеличивать.
              </p>
            ) : (
              <p className="home__plan-item-drawer-text">
                {isEarlyRise
                  ? isEarlyRiseWeekendRest
                    ? "С понедельника снова обычный режим раннего подъёма."
                    : earlyRiseEnforcementActive
                    ? "В целевое время откроется 5 минут — нажмите «Я проснулся». Не успели — GG и день не засчитан. После 3 успешных дней подъём сдвинется на 5 минут раньше."
                    : warmupDay?.message ??
                      "Сегодня разгонный день — подъём по желанию, без штрафов. С завтрашнего утра — полный режим."
                  : isPlank
                    ? "Посмотрите технику ниже, затем нажмите «Начать» — будет короткий отсчёт и таймер планки."
                  : isWarmup
                    ? `Посмотрите технику разминки ниже, затем нажмите «Начать» для таймера на ${STRETCH_TARGET_MINUTES} минут.`
                  : isBooks
                    ? selectedBook
                      ? isBookFinished
                        ? `«${selectedBook.title}» прочитана. Можно выбрать следующую книгу.`
                        : `Читаешь «${selectedBook.title}». Нажми «${booksStartLabel}» на карточке — откроется книга.`
                      : "Выбери книгу из рекомендаций — или нажми «Начать» для таймера фокуса."
                    : isSmoking
                      ? "После каждой сигареты нажмите «Покурил сигарету»."
                    : isSocialMedia
                      ? doomSession
                        ? "Таймер идёт. Можно закончить раньше — минуты запишутся в дневной лимит. В конце придёт напоминание закрыть приложение."
                        : socialMediaMinutesLeft <= 0
                          ? "На сегодня лимит исчерпан. Новая сессия будет доступна завтра."
                          : nextSessionMinutes < 15
                            ? `До лимита осталось ${socialMediaMinutesLeft} мин — сессия будет короче обычных 15 минут.`
                            : "Нажмите «Начать», выберите приложение и получите таймер на 15 минут с напоминанием в конце."
                    : showDarkValueLog
                      ? "Нажмите «Записать», чтобы указать, сколько всего сегодня."
                    : block
                      ? block.unit === "seconds"
                        ? `Следующая сессия: ${block.expected_yield} ${formatUnit(block.unit)}.`
                        : `Следующая сессия: ${block.duration_min} мин. Ожидаемый результат — ~${block.expected_yield} ${formatUnit(block.unit)}.`
                      : goalReached
                        ? "Цель на сегодня выполнена. Можно добавить сверх плана или начать ещё одну сессию."
                        : "Нажмите «Начать», чтобы запустить таймер фокуса."}
              </p>
            )}
            {isStrengthWorkout ? (
              <StrengthWorkoutCircuit
                habitId={habit.id}
                planDate={planDate}
                currentValue={currentValue}
                dailyGoalMinutes={habit.current_goal}
                repsPerExercise={strengthReps}
                isPending={isPending}
                resetKey={strengthResetKey}
                onRoundComplete={() => {
                  setStrengthRoundComplete(true);
                  setStrengthExercisesDone(STRENGTH_WORKOUT_REPS_PER_ROUND);
                }}
                onProgressChange={setStrengthExercisesDone}
                onRepComplete={async (nextValue) => {
                  setActionError(null);
                  try {
                    await checkinMutation.mutateAsync({
                      habit_id: habit.id,
                      value: nextValue,
                    });
                  } catch (err) {
                    setActionError(
                      err instanceof ClientApiError
                        ? err.message
                        : err instanceof Error
                          ? err.message
                          : "Не удалось сохранить",
                    );
                    throw err;
                  }
                }}
              />
            ) : null}
            {isPlank ? <PlankTechniqueDemo /> : null}
            {isWarmup ? <WarmupTechniqueDemo /> : null}
            {isBooks && selectedBook && (selectedBookRemainingEstimate || isBookFinished) ? (
              <div className="home__plan-item-book-plan-block">
                <p className="home__plan-item-book-plan-detail">
                  {isBookFinished
                    ? formatBookFinishedLabel()
                    : `${formatBookReadingMinutesLabel(pagesLeftInBook!)} · ${formatHabitBookRemainingTime(selectedBookRemainingEstimate!)}`}
                </p>
              </div>
            ) : null}
            {isBooks ? (
              <div className="home__plan-book-actions">
                <button
                  type="button"
                  className="home__plan-drawer-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    setBookPickerOpen(true);
                  }}
                >
                  {selectedBook ? "Сменить книгу" : "Выбрать книгу"}
                </button>
              </div>
            ) : null}
          </div>
        </CollapsibleReveal>
      </article>

      <QuickAddPrompt
        isOpen={quickAddOpen}
        habitId={habit.id}
        habitName={habit.name}
        unit={habit.unit}
        side={side}
        templateId={habit.template_id}
        categoryKey={habit.category_key}
        icon={habit.icon}
        chips={quickAddChips}
        isSubmitting={checkinMutation.isPending}
        onCancel={() => setQuickAddOpen(false)}
        onAdd={(amount) => void handleQuickAdd(amount)}
      />

      <BookPickerModal
        isOpen={bookPickerOpen}
        selectedBookId={selectedBook?.id ?? null}
        onClose={() => setBookPickerOpen(false)}
        onSelect={handleBookSelect}
      />

      <ExtraSessionModal
        isOpen={extraSessionOpen}
        habitName={habit.name}
        unit={habit.unit}
        goal={habit.current_goal}
        defaultPlan={defaultExtraSessionPlan}
        isStarting={sessionBusy}
        onClose={() => setExtraSessionOpen(false)}
        onConfirm={(plan) => {
          setExtraSessionOpen(false);
          onStart?.(plan);
        }}
      />

      {showCoachButton ? (
        <DarkCoachSheet
          open={coachOpen}
          habitId={habit.id}
          habitName={habit.name}
          templateId={habit.template_id}
          onClose={() => setCoachOpen(false)}
        />
      ) : null}

      {showDarkValueLog ? (
        <ValuePrompt
          isOpen={darkValueOpen}
          habitName={habit.name}
          unit={habit.unit}
          expectedYield={currentValue}
          showExpectedHint={false}
          inputLabel="Сколько всего сегодня?"
          isSubmitting={checkinMutation.isPending}
          onCancel={() => setDarkValueOpen(false)}
          onSubmit={(value) => {
            void (async () => {
              try {
                await runCheckin({ habit_id: habit.id, value });
                setDarkValueOpen(false);
              } catch {
                // runCheckin already sets actionError
              }
            })();
          }}
        />
      ) : null}

      {isSocialMedia ? (
        <DoomScrollAppPicker
          isOpen={doomPickerOpen}
          isSubmitting={doomScrollMutation.isPending}
          onCancel={() => setDoomPickerOpen(false)}
          onSelect={(platform) => {
            void doomScrollMutation.mutateAsync(platform);
          }}
        />
      ) : null}
    </>
  );
}
