import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { DailyPlanBlock, HabitReadingProgress, HabitSessionResponse, TodayDarkHabit, TodayLightHabit } from "@mytodo/shared";
import {
  isEarlyRiseCategoryKey,
  isMeditationHabit,
  isForeignLanguageHabit,
  isNonSessionLightCategory,
  isPlankHabit,
  isWarmupHabit,
  isStrengthWorkoutHabit,
  resolveStrengthProgressionLevel,
  strengthRepsPerExercise,
  STRENGTH_WORKOUT_REPS_PER_ROUND,
  STRETCH_TARGET_MINUTES,
} from "@mytodo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientApiError, clearHabitBook, getEnglishToday, resetTodayCheckin, selectHabitBook } from "../../lib/api";
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
import { getSessionRemainingSeconds } from "../sessions/sessionRecovery";
import {
  resolveSessionPlan,
  type StartSessionOverrides,
} from "../sessions/sessionPlan";
import { isBooksHabit } from "./isBooksHabit";
import { StrengthWorkoutCircuit, clearStrengthCircuitStorage, countStrengthCircuitExercisesDone, isStrengthCircuitRoundComplete } from "./StrengthWorkoutCircuit";
import { PlankTechniqueDemo } from "./PlankTechniqueDemo";
import { WarmupTechniqueDemo } from "./WarmupTechniqueDemo";
import { MeditationGuide } from "./MeditationGuide";
import { EnglishLessonDrawer } from "./EnglishLessonDrawer";
import { stopVkEmbedsInContainer } from "../english/vk-api";
import { englishQueryKeys } from "../english/useEnglish";
import { prefetchExerciseMedia } from "../../lib/exercise-media";

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
  onStart,
  onAbortSessionForBookChange,
}: DailyPlanHabitRowProps) {
  const checkinMutation = useCheckinMutation(side);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedLook, setExpandedLook] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<SelectedBook | null>(null);
  const status = habit.checkin?.status;
  const isBooks = isBooksHabit(habit);
  const isStrengthWorkout = isStrengthWorkoutHabit(habit);
  const isPlank = isPlankHabit(habit);
  const isWarmup = isWarmupHabit(habit);
  const isMeditation = isMeditationHabit(habit);
  const isForeignLanguage = isForeignLanguageHabit(habit);
  useQuery({
    queryKey: englishQueryKeys.today,
    queryFn: getEnglishToday,
    enabled: isForeignLanguage,
    staleTime: 5 * 60_000,
  });
  const strengthReps = strengthRepsPerExercise(
    resolveStrengthProgressionLevel(habit.baseline_value, habit.current_goal),
  );
  const reading = habitReading(habit);
  const isEarlyRise = isEarlyRiseCategoryKey(habit.category_key);
  const isNonSessionHabit = isNonSessionLightCategory(habit.category_key);
  const selectedBookPageCount =
    reading?.page_count ?? (selectedBook ? getBookPageCount(selectedBook.id) : null);
  const currentValue = habit.checkin?.value ?? 0;
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
  const goalReached = status === "success";
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
  const [lessonWatchMinutes, setLessonWatchMinutes] = useState(0);
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
    if (!expanded && isForeignLanguage) {
      setLessonWatchMinutes(0);
      stopVkEmbedsInContainer(habitCardRef.current);
    }
  }, [expanded, isForeignLanguage]);

  const startDisabled =
    sessionBusy || focusLocked || hasActiveFocus || !canStartSession;
  const canQuickAdd =
    habit.type === "target" &&
    status !== "skipped" &&
    !isNonSessionHabit &&
    !isStrengthWorkout;
  const sessionProgress = getLiveSessionProgress(habit.unit, sessionElapsedSeconds);
  const hasSessionProgress = sessionProgress > 0;
  const booksSessionPages =
    isBooks && hasSessionProgress
      ? currentValue + getLiveSessionProgressLabel(habit.unit, sessionElapsedSeconds)
      : 0;
  const booksDailyProgress = isBooks
    ? Math.max(currentValue, todayPagesRead, booksSessionPages)
    : currentValue;
  const progressValue = hasSessionProgress
    ? currentValue + sessionProgress
    : isForeignLanguage
      ? Math.max(currentValue, lessonWatchMinutes)
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
    : hasSessionProgress
    ? habit.unit === "minutes" && progressValue < 10
      ? progressValue.toFixed(1)
      : String(
          Math.floor(
            currentValue + getLiveSessionProgressLabel(habit.unit, sessionElapsedSeconds),
          ),
        )
    : isForeignLanguage
      ? String(Math.max(currentValue, lessonWatchMinutes))
    : String(currentValue);
  const strengthProgressLabel = `${displayProgressValue} / ${STRENGTH_WORKOUT_REPS_PER_ROUND} упражн.`;
  const progressLabelText = isStrengthWorkout
    ? strengthProgressLabel
    : isBooks
      ? formatBooksDailyProgressLabel(booksDailyProgress, habit.current_goal)
      : `${progressLabelValue} / ${habit.current_goal} ${formatUnit(habit.unit)}`;
  const cardHint = isStrengthWorkout && !goalReached
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

  const handleBookSelect = async (book: SelectedBook | null) => {
    if (book === null) {
      setActionError(null);
      try {
        await onAbortSessionForBookChange?.(habit.id);
        await resetTodayCheckin(habit.id);
        await clearHabitBook(habit.id);
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
        await resetTodayCheckin(habit.id);
        await selectHabitBook(habit.id, {
          book_id: book.id,
          checkin_baseline: 0,
        });
      } else {
        await selectHabitBook(habit.id, {
          book_id: book.id,
        });
      }
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
      : resolveBadge(habit, block);

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
        ? `Начать · ${formatSessionDuration(block)}`
        : "Начать";

  const quickAddChips =
    habit.unit === "minutes" ? [5, 10, 15] : habit.unit === "pages" ? [1, 2, 5] : [];

  return (
    <>
      <article
        ref={habitCardRef}
        className={[
          "home__plan-item",
          expandedLook ? "home__plan-item--expanded" : "",
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

        <p className="home__plan-item-goal">{formatGoalLabel(habit, wakeTime)}</p>

        {timer ? (
          <p className="home__task-timer">Чистое время: {formatTimer(timer.elapsed)}</p>
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

          {isEarlyRise && status !== "success" && status !== "skipped" ? (
            <button
              type="button"
              className="home__task-btn home__task-btn--start"
              disabled={isPending || sessionBusy}
              onClick={(event) => {
                event.stopPropagation();
                void runCheckin({
                  habit_id: habit.id,
                  value: habit.current_goal,
                });
              }}
            >
              Подъём выполнен
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

        <CollapsibleReveal
          open={expanded}
          scrollBehavior="none"
          onCollapsed={() => setExpandedLook(false)}
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
                open={expanded}
                goalMinutes={habit.current_goal}
                onWatchMinutesChange={setLessonWatchMinutes}
                onPlanComplete={
                  status === "success" || status === "skipped"
                    ? undefined
                    : async () => {
                        await checkinMutation.mutateAsync({
                          habit_id: habit.id,
                          value: Math.max(currentValue, habit.current_goal),
                        });
                      }
                }
              />
            ) : isStrengthWorkout ? (
              <p className="home__plan-item-drawer-text home__strength-circuit-intro">
                Каждое упражнение — по {strengthReps} раз. Со временем будем увеличивать.
              </p>
            ) : (
              <p className="home__plan-item-drawer-text">
                {isEarlyRise
                  ? "Цель — проснуться не позже указанного времени. После 3 успешных дней подъём сдвинется на 5 минут раньше."
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
        habitName={habit.name}
        unit={habit.unit}
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
    </>
  );
}
