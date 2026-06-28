import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClientApiError, getEnglishToday } from "../../lib/api";
import {
  formatEnglishLessonLabel,
  formatLessonDuration,
  formatWatchProgress,
  canAutoCompleteEnglishLesson,
  parseYouTubeVideoId,
  resolveEnglishCompleteWatchSec,
  resolveEnglishWatchRequirement,
} from "../english/format";
import { YouTubeLessonPlayer } from "../english/YouTubeLessonPlayer";
import { englishQueryKeys, useEnglishMutations } from "../english/useEnglish";

type EnglishLessonDrawerProps = {
  open: boolean;
  goalMinutes?: number;
  onWatchMinutesChange?: (minutes: number) => void;
  onPlanComplete?: () => void | Promise<void>;
};

function EnglishInlineReveal({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "home__english-inline-reveal",
        open ? "home__english-inline-reveal--open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!open}
    >
      <div className="home__english-inline-reveal-inner">
        <div
          className={[
            "home__english-inline-reveal-content",
            open ? "home__english-inline-reveal-content--visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function EnglishLessonSkeleton() {
  return (
    <div className="home__english-lesson home__english-lesson--loading" aria-busy="true" aria-label="Загружаем урок">
      <div className="home__english-lesson-skeleton-line" />
      <div className="home__english-lesson-skeleton-line home__english-lesson-skeleton-line--short" />
      <div className="home__english-lesson-skeleton-btn" />
    </div>
  );
}

export function EnglishLessonDrawer({
  open,
  goalMinutes,
  onWatchMinutesChange,
  onPlanComplete,
}: EnglishLessonDrawerProps) {
  const { data: today, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: englishQueryKeys.today,
    queryFn: getEnglishToday,
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const { enable, complete } = useEnglishMutations();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [watchedSec, setWatchedSec] = useState(0);
  const [playerDurationSec, setPlayerDurationSec] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const autoCompletedRef = useRef(false);
  const reportedMinuteRef = useRef(-1);

  const lesson = today?.enabled ? today.lesson : null;
  const videoId = lesson ? parseYouTubeVideoId(lesson.video_url) : null;
  const dayStatus = today?.enabled ? today.day_status : null;
  const isFinishedToday = dayStatus === "success" || dayStatus === "skipped";

  const { requiredWatchSec } = useMemo(() => {
    if (!lesson) {
      return { requiredWatchSec: 0 };
    }
    return resolveEnglishWatchRequirement(lesson.duration_sec, playerDurationSec);
  }, [lesson, playerDurationSec]);

  const watchProgress = formatWatchProgress(watchedSec, requiredWatchSec);

  const lessonSyncKey =
    today?.enabled === true ? `${today.current_day}:${today.lesson.id}:${today.day_status ?? "open"}` : null;
  const lessonIdentityKey =
    today?.enabled === true ? `${today.current_day}:${today.lesson.id}` : null;
  const serverWatchedSec = today?.enabled === true ? today.watched_sec : 0;

  useEffect(() => {
    if (!open) {
      setPlayerOpen(false);
      setActionError(null);
      setPlayerDurationSec(null);
      reportedMinuteRef.current = -1;
      onWatchMinutesChange?.(0);
    }
  }, [open, onWatchMinutesChange]);

  useEffect(() => {
    if (!lessonIdentityKey) {
      return;
    }
    setPlayerDurationSec(null);
  }, [lessonIdentityKey]);

  useEffect(() => {
    if (!lessonSyncKey) {
      return;
    }
    autoCompletedRef.current = false;
    setWatchedSec(serverWatchedSec);
  }, [lessonSyncKey, serverWatchedSec]);

  const handleDurationReady = useCallback((duration: number) => {
    setPlayerDurationSec((current) => (current === duration ? current : duration));
  }, []);

  const finalizeLesson = useCallback(
    async (seconds: number) => {
      if (!lesson || !canAutoCompleteEnglishLesson(seconds, lesson.duration_sec)) {
        return false;
      }

      setActionError(null);
      try {
        const watchedForApi = resolveEnglishCompleteWatchSec(seconds, lesson.duration_sec);
        await complete.mutateAsync(watchedForApi);
        if (goalMinutes != null) {
          onWatchMinutesChange?.(goalMinutes);
        }
        await onPlanComplete?.();
        return true;
      } catch (error) {
        setActionError(
          error instanceof ClientApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Не удалось отметить урок",
        );
        return false;
      }
    },
    [complete, goalMinutes, lesson, onPlanComplete, onWatchMinutesChange],
  );

  const handleWatchProgress = useCallback(
    (seconds: number) => {
      setWatchedSec((current) => Math.max(current, seconds));
      if (goalMinutes != null) {
        const minutes = Math.min(goalMinutes, Math.ceil(seconds / 60));
        if (minutes !== reportedMinuteRef.current) {
          reportedMinuteRef.current = minutes;
          onWatchMinutesChange?.(minutes);
        }
      }
    },
    [goalMinutes, onWatchMinutesChange],
  );

  const handleOpenLesson = async () => {
    setActionError(null);
    setIsOpening(true);
    try {
      if (!today?.enabled) {
        await enable.mutateAsync();
        const refreshed = await refetch();
        if (!refreshed.data?.enabled) {
          throw new Error("Не удалось включить курс");
        }
      }
      setPlayerOpen(true);
    } catch (error) {
      setActionError(
        error instanceof ClientApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Не удалось открыть урок",
      );
    } finally {
      setIsOpening(false);
    }
  };

  const handleVideoEnded = useCallback(
    (seconds: number) => {
      if (isFinishedToday || autoCompletedRef.current || complete.isPending || !lesson) {
        return;
      }

      autoCompletedRef.current = true;
      const finalSeconds = Math.max(
        seconds,
        resolveEnglishCompleteWatchSec(seconds, lesson.duration_sec),
      );
      setWatchedSec(finalSeconds);
      if (goalMinutes != null) {
        onWatchMinutesChange?.(goalMinutes);
      }
      void finalizeLesson(finalSeconds).then((completed) => {
        if (!completed) {
          autoCompletedRef.current = false;
        }
      });
    },
    [
      complete.isPending,
      finalizeLesson,
      goalMinutes,
      isFinishedToday,
      lesson,
      onWatchMinutesChange,
    ],
  );

  if (!open) {
    return null;
  }

  if (isLoading && !today) {
    return <EnglishLessonSkeleton />;
  }

  if (isError) {
    return (
      <div className="home__english-lesson home__english-fade-in">
        <p className="home__task-error" role="alert">
          Не удалось загрузить урок.
        </p>
        <button
          type="button"
          className="home__plan-drawer-btn"
          onClick={(event) => {
            event.stopPropagation();
            void refetch();
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  const dayNumber = lesson?.day_number ?? (today?.enabled ? today.current_day : 1);
  const displayDurationSec = playerDurationSec ?? lesson?.duration_sec ?? 0;

  return (
    <div className="home__english-lesson home__english-fade-in">
      <p className="home__plan-item-drawer-text home__plan-item-drawer-text--lesson">
        {today?.enabled && lesson
          ? formatEnglishLessonLabel(dayNumber)
          : "Каждый день — новое видео из курса. Открой урок и смотри прямо здесь."}
      </p>

      {dayStatus === "success" ? (
        <p className="home__plan-item-hint home__plan-item-hint--success">
          Урок на сегодня пройден. Завтра откроется{" "}
          {formatEnglishLessonLabel(today?.enabled ? today.preview_next_day : dayNumber + 1)}.
        </p>
      ) : null}

      {dayStatus === "skipped" ? (
        <p className="home__plan-item-hint">
          Сегодня пропущено — завтра снова {formatEnglishLessonLabel(dayNumber)}.
        </p>
      ) : null}

      <EnglishInlineReveal open={!playerOpen}>
        <button
          type="button"
          className="home__plan-drawer-btn home__plan-drawer-btn--primary"
          disabled={isOpening || isFetching}
          onClick={(event) => {
            event.stopPropagation();
            void handleOpenLesson();
          }}
        >
          {isOpening ? "Открываем…" : isFinishedToday ? "Пересмотреть урок" : "Открыть урок"}
        </button>
      </EnglishInlineReveal>

      <EnglishInlineReveal open={playerOpen && Boolean(lesson && videoId)}>
        {lesson && videoId ? (
          <div className="home__english-lesson-player">
            <YouTubeLessonPlayer
              key={videoId}
              videoId={videoId}
              durationSec={lesson.duration_sec}
              onDurationReady={handleDurationReady}
              onWatchProgress={handleWatchProgress}
              onVideoEnded={handleVideoEnded}
            />
            <p className="home__english-lesson-meta">
              Длительность: {formatLessonDuration(displayDurationSec)}
            </p>

            {!isFinishedToday ? (
              <>
                <div className="home__english-lesson-progress" aria-hidden="true">
                  <div
                    className="home__english-lesson-progress-fill"
                    style={{ width: `${watchProgress}%` }}
                  />
                </div>
                <p className="home__english-lesson-progress-label">
                  {complete.isPending
                    ? "Сохраняем…"
                    : watchProgress >= 100
                      ? "Урок засчитывается…"
                      : `Просмотрено ${watchProgress}%`}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </EnglishInlineReveal>

      {actionError ? (
        <p className="home__task-error" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
