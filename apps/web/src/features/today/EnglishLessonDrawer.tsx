import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClientApiError, getEnglishToday } from "../../lib/api";
import {
  formatEnglishLessonLabel,
  formatWatchProgress,
  canAutoCompleteEnglishLesson,
  parseVkVideoRef,
  resolveEnglishCompleteWatchSec,
  resolveEnglishHabitGoalMinutes,
  resolveEnglishLessonDuration,
  resolveEnglishWatchRequirement,
} from "../english/format";
import { VkLessonPlayer } from "../english/VkLessonPlayer";
import { stopVkEmbedsInContainer } from "../english/vk-api";
import { englishQueryKeys, useEnglishMutations } from "../english/useEnglish";

const WATCH_SAVE_DEBOUNCE_MS = 3000;

type EnglishLessonDrawerProps = {
  expanded: boolean;
  playerOpen: boolean;
  onPlayerOpenChange: (open: boolean) => void;
  goalMinutes?: number;
  onWatchMinutesChange?: (minutes: number) => void;
  onPlanComplete?: () => void | Promise<void>;
  onLessonComplete?: () => void;
};

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
  expanded,
  playerOpen,
  onPlayerOpenChange,
  goalMinutes,
  onWatchMinutesChange,
  onPlanComplete,
  onLessonComplete,
}: EnglishLessonDrawerProps) {
  const shouldLoad = expanded || playerOpen;
  const { data: today, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: englishQueryKeys.today,
    queryFn: getEnglishToday,
    enabled: shouldLoad,
    staleTime: 0,
  });
  const { enable, complete, watch } = useEnglishMutations();
  const [watchedSec, setWatchedSec] = useState(0);
  const [playerDurationSec, setPlayerDurationSec] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [playerRevealed, setPlayerRevealed] = useState(false);
  const [playerSessionKey, setPlayerSessionKey] = useState(0);
  const autoCompletedRef = useRef(false);
  const reportedMinuteRef = useRef(-1);
  const pendingWatchSecRef = useRef(0);
  const watchSaveTimerRef = useRef<number | null>(null);
  const playerRootRef = useRef<HTMLDivElement>(null);

  const lesson = today?.enabled ? today.lesson : null;
  const vkVideo = lesson ? parseVkVideoRef(lesson.video_url) : null;
  const dayStatus = today?.enabled ? today.day_status : null;
  const isFinishedToday = dayStatus === "success";

  const { requiredWatchSec } = useMemo(() => {
    if (!lesson) {
      return { requiredWatchSec: 0 };
    }
    return resolveEnglishWatchRequirement(lesson.duration_sec, playerDurationSec);
  }, [lesson, playerDurationSec]);

  const watchProgress = formatWatchProgress(watchedSec, requiredWatchSec);

  const lessonSyncKey =
    today?.enabled === true ? `${today.lesson.id}:${today.day_status ?? "open"}` : null;
  const lessonIdentityKey = today?.enabled === true ? today.lesson.id : null;
  const serverWatchedSec = today?.enabled === true ? today.watched_sec : 0;

  const flushWatchProgress = useCallback(
    async (seconds: number) => {
      if (isFinishedToday || !today?.enabled) {
        return;
      }
      try {
        await watch.mutateAsync(Math.floor(seconds));
      } catch {
        // Keep local progress; next debounced save will retry.
      }
    },
    [isFinishedToday, today?.enabled, watch],
  );

  const scheduleWatchSave = useCallback(
    (seconds: number) => {
      pendingWatchSecRef.current = Math.max(pendingWatchSecRef.current, seconds);
      if (watchSaveTimerRef.current != null) {
        window.clearTimeout(watchSaveTimerRef.current);
      }
      watchSaveTimerRef.current = window.setTimeout(() => {
        watchSaveTimerRef.current = null;
        flushWatchProgress(pendingWatchSecRef.current);
      }, WATCH_SAVE_DEBOUNCE_MS);
    },
    [flushWatchProgress],
  );

  useEffect(() => {
    return () => {
      if (watchSaveTimerRef.current != null) {
        window.clearTimeout(watchSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!expanded && !playerOpen) {
      setActionError(null);
      reportedMinuteRef.current = -1;
    }
  }, [expanded, playerOpen]);

  useEffect(() => {
    if (!playerOpen) {
      setPlayerRevealed(false);
      return;
    }

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          setPlayerRevealed(true);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [playerOpen]);

  useEffect(() => {
    if (playerOpen) {
      return;
    }

    if (watchSaveTimerRef.current != null) {
      window.clearTimeout(watchSaveTimerRef.current);
      watchSaveTimerRef.current = null;
    }

    stopVkEmbedsInContainer(playerRootRef.current);

    const pendingSeconds = pendingWatchSecRef.current;
    if (pendingSeconds > 0 && !isFinishedToday && today?.enabled === true) {
      void flushWatchProgress(pendingSeconds);
    }
  }, [playerOpen, isFinishedToday, today?.enabled, flushWatchProgress]);

  useEffect(() => {
    if (!lessonIdentityKey) {
      return;
    }
    setPlayerDurationSec(null);
    if (!playerOpen) {
      setPlayerSessionKey(0);
    }
  }, [lessonIdentityKey, playerOpen]);

  useEffect(() => {
    if (!lessonSyncKey) {
      return;
    }
    autoCompletedRef.current = false;
    setWatchedSec(serverWatchedSec);
    pendingWatchSecRef.current = serverWatchedSec;
  }, [lessonSyncKey, serverWatchedSec]);

  const handleDurationReady = useCallback((duration: number) => {
    setPlayerDurationSec((current) => (current === duration ? current : duration));
  }, []);

  const finalizeLesson = useCallback(
    async (seconds: number, durationOverride?: number) => {
      if (!lesson) {
        return false;
      }
      const lessonDuration = resolveEnglishLessonDuration(
        lesson.duration_sec,
        durationOverride ?? playerDurationSec,
      );
      if (!canAutoCompleteEnglishLesson(seconds, lessonDuration)) {
        return false;
      }

      setActionError(null);
      try {
        const watchedForApi = Math.floor(
          resolveEnglishCompleteWatchSec(seconds, lessonDuration),
        );
        await complete.mutateAsync(watchedForApi);
        await onPlanComplete?.();
        if (goalMinutes != null) {
          onWatchMinutesChange?.(goalMinutes);
        }
        onLessonComplete?.();
        onPlayerOpenChange(false);
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
    [
      complete,
      goalMinutes,
      lesson,
      onLessonComplete,
      onPlanComplete,
      onPlayerOpenChange,
      onWatchMinutesChange,
      playerDurationSec,
    ],
  );

  const handleWatchProgress = useCallback(
    (seconds: number) => {
      setWatchedSec((current) => {
        const next = Math.max(current, seconds);
        scheduleWatchSave(next);
        return next;
      });
      if (goalMinutes != null && lesson) {
        const lessonDuration = resolveEnglishLessonDuration(
          lesson.duration_sec,
          playerDurationSec,
        );
        const minutes = resolveEnglishHabitGoalMinutes(
          seconds,
          lessonDuration,
          goalMinutes,
          false,
        );
        if (minutes !== reportedMinuteRef.current) {
          reportedMinuteRef.current = minutes;
          onWatchMinutesChange?.(minutes);
        }
      }
    },
    [goalMinutes, lesson, onWatchMinutesChange, playerDurationSec, scheduleWatchSave],
  );

  const handleOpenLesson = async () => {
    setActionError(null);
    setIsOpening(true);
    try {
      let payload = today;
      if (!payload?.enabled) {
        await enable.mutateAsync();
        const refreshed = await refetch();
        payload = refreshed.data;
        if (!payload?.enabled) {
          throw new Error("Не удалось включить курс");
        }
      }

      if (!payload.lesson) {
        throw new Error("Урок не найден");
      }

      const video = parseVkVideoRef(payload.lesson.video_url);
      if (!video) {
        throw new Error("Не удалось разобрать ссылку на видео");
      }

      setPlayerSessionKey((key) => key + 1);
      onPlayerOpenChange(true);
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
    ({ watchedSec: seconds, durationSec }: { watchedSec: number; durationSec: number }) => {
      if (isFinishedToday || autoCompletedRef.current || complete.isPending || !lesson) {
        return;
      }

      autoCompletedRef.current = true;
      const lessonDuration = resolveEnglishLessonDuration(lesson.duration_sec, durationSec);
      const finalSeconds = Math.floor(
        Math.max(seconds, resolveEnglishCompleteWatchSec(seconds, lessonDuration)),
      );
      setWatchedSec(finalSeconds);
      setPlayerDurationSec((current) => (durationSec > current ? durationSec : current));
      pendingWatchSecRef.current = finalSeconds;
      void (async () => {
        try {
          await flushWatchProgress(finalSeconds);
          const completed = await finalizeLesson(finalSeconds, durationSec);
          if (!completed) {
            autoCompletedRef.current = false;
            setPlayerSessionKey((key) => key + 1);
            reportedMinuteRef.current = -1;
            onWatchMinutesChange?.(0);
          }
        } catch {
          autoCompletedRef.current = false;
          setPlayerSessionKey((key) => key + 1);
          reportedMinuteRef.current = -1;
          onWatchMinutesChange?.(0);
        }
      })();
    },
    [
      complete.isPending,
      finalizeLesson,
      flushWatchProgress,
      isFinishedToday,
      lesson,
      onWatchMinutesChange,
    ],
  );

  if (!shouldLoad) {
    return null;
  }

  if (isLoading && !today) {
    return expanded ? <EnglishLessonSkeleton /> : null;
  }

  if (isError) {
    return expanded ? (
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
    ) : null;
  }

  const dayNumber = lesson?.day_number ?? (today?.enabled ? today.current_day : 1);

  return (
    <div
      className={["home__english-lesson", expanded ? "home__english-fade-in" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {expanded ? (
        <>
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

          <div
            className={[
              "home__english-open-lesson-btn-wrap",
              playerOpen ? "home__english-open-lesson-btn-wrap--collapsed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
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
          </div>
        </>
      ) : null}

      <div
        ref={playerRootRef}
        className={[
          "home__english-inline-reveal",
          playerOpen ? "home__english-inline-reveal--open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!playerOpen}
      >
        <div className="home__english-inline-reveal-inner">
          <div
            className={[
              "home__english-inline-reveal-content",
              playerRevealed ? "home__english-inline-reveal-content--visible" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {playerOpen ? (
              lesson && vkVideo ? (
                <div className="home__english-lesson-player">
                  <VkLessonPlayer
                    key={`${vkVideo.oid}:${vkVideo.id}:${playerSessionKey}`}
                    video={vkVideo}
                    pageUrl={lesson.video_url}
                    durationSec={lesson.duration_sec}
                    suppressDoneOverlay
                    onDurationReady={handleDurationReady}
                    onWatchProgress={handleWatchProgress}
                    onVideoEnded={handleVideoEnded}
                    onRewatch={() => {
                      onPlayerOpenChange(true);
                      setPlayerSessionKey((key) => key + 1);
                    }}
                  />

                  {!isFinishedToday && requiredWatchSec > 0 ? (
                    <>
                      <div className="home__english-lesson-progress" aria-hidden="true">
                        <div
                          className="home__english-lesson-progress-fill"
                          style={{ width: `${watchProgress}%` }}
                        />
                      </div>
                      <p className="home__plan-item-hint">
                        {complete.isPending
                          ? "Сохраняем…"
                          : requiredWatchSec > 0
                            ? `Просмотрено ${watchProgress}%`
                            : "Нажмите play и смотрите до конца"}
                      </p>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="home__task-error" role="alert">
                  {actionError ?? "Не удалось загрузить видео урока."}
                </p>
              )
            ) : null}
          </div>
        </div>
      </div>

      {expanded && actionError ? (
        <p className="home__task-error" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
