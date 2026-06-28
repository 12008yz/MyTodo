import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ENGLISH_LESSON_COUNT,
  ENGLISH_WATCH_THRESHOLD,
} from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";
import {
  canAutoCompleteEnglishLesson,
  formatEnglishLessonLabel,
  formatLessonDuration,
  formatWatchProgress,
  parseYouTubeVideoId,
  resolveEnglishCompleteWatchSec,
  resolveEnglishWatchRequirement,
} from "../../features/english/format";
import { useEnglishHistory, useEnglishMutations, useEnglishToday } from "../../features/english/useEnglish";
import { YouTubeLessonPlayer } from "../../features/english/YouTubeLessonPlayer";
import "./EnglishPage.css";

function formatDisplayDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function EnglishPage() {
  const navigate = useNavigate();
  const { data: today, isLoading, isError, refetch } = useEnglishToday();
  const historyEnabled = today?.enabled === true;
  const { data: history } = useEnglishHistory(historyEnabled);
  const { enable, complete, skip } = useEnglishMutations();

  const [watchedSec, setWatchedSec] = useState(0);
  const [playerDurationSec, setPlayerDurationSec] = useState<number | null>(null);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const autoCompletedRef = useRef(false);

  const lesson = today?.enabled ? today.lesson : null;
  const videoId = lesson ? parseYouTubeVideoId(lesson.video_url) : null;

  const { requiredWatchSec } = useMemo(() => {
    if (!lesson) {
      return { requiredWatchSec: 0 };
    }
    return resolveEnglishWatchRequirement(lesson.duration_sec, playerDurationSec);
  }, [lesson, playerDurationSec]);

  const watchProgress = formatWatchProgress(watchedSec, requiredWatchSec);
  const dayStatus = today?.enabled ? today.day_status : null;
  const isFinishedToday = dayStatus === "success" || dayStatus === "skipped";
  const lessonSyncKey =
    today?.enabled === true ? `${today.current_day}:${today.lesson.id}:${today.day_status ?? "open"}` : null;
  const lessonIdentityKey =
    today?.enabled === true ? `${today.current_day}:${today.lesson.id}` : null;
  const serverWatchedSec = today?.enabled === true ? today.watched_sec : 0;

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

  const handleWatchProgress = useCallback((seconds: number) => {
    setWatchedSec((current) => Math.max(current, seconds));
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
    [complete, lesson],
  );

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
      void finalizeLesson(finalSeconds).then((completed) => {
        if (!completed) {
          autoCompletedRef.current = false;
        }
      });
    },
    [complete.isPending, finalizeLesson, isFinishedToday, lesson],
  );

  const handleEnable = async () => {
    setActionError(null);
    try {
      await enable.mutateAsync();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось включить модуль");
    }
  };

  const handleSkip = async () => {
    setActionError(null);
    try {
      await skip.mutateAsync();
      setSkipConfirmOpen(false);
    } catch (error) {
      setActionError(
        error instanceof ClientApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Не удалось пропустить урок",
      );
    }
  };

  if (isLoading) {
    return (
      <EnglishShell onBack={() => navigate("/profile")}>
        <p className="english-page__placeholder">Загружаем урок…</p>
      </EnglishShell>
    );
  }

  if (isError || !today) {
    return (
      <EnglishShell onBack={() => navigate("/profile")}>
        <p className="english-page__placeholder english-page__placeholder--error" role="alert">
          Не удалось загрузить урок.
        </p>
        <button type="button" className="english-page__btn english-page__btn--primary" onClick={() => void refetch()}>
          Повторить
        </button>
      </EnglishShell>
    );
  }

  if (!today.enabled) {
    return (
      <EnglishShell onBack={() => navigate("/profile")}>
        <div className="english-page__welcome">
          <div className="english-page__welcome-badge" aria-hidden="true">
            🇬🇧
          </div>
          <h1 className="english-page__welcome-title">Английский с нуля</h1>
          <p className="english-page__welcome-lead">
            Каждый день — одно видео из полного курса. Спокойный темп, без перегруза.
          </p>
          <ul className="english-page__welcome-list">
            <li>{ENGLISH_LESSON_COUNT} уроков по порядку</li>
            <li>1 видео в день · до 2 пропусков в неделю</li>
            <li>Урок засчитывается после просмотра ≥ {Math.round(ENGLISH_WATCH_THRESHOLD * 100)}%</li>
          </ul>
          {actionError ? (
            <p className="english-page__error" role="alert">
              {actionError}
            </p>
          ) : null}
          <button
            type="button"
            className="english-page__btn english-page__btn--primary english-page__btn--wide"
            disabled={enable.isPending}
            onClick={() => void handleEnable()}
          >
            {enable.isPending ? "Включаем…" : "Начать курс"}
          </button>
        </div>
      </EnglishShell>
    );
  }

  const progressPercent = Math.round((today.current_day / ENGLISH_LESSON_COUNT) * 100);

  return (
    <EnglishShell onBack={() => navigate("/profile")}>
      {isDemoMode() ? (
        <p className="english-page__demo-banner" role="status">
          Демо-режим — прогресс сохраняется локально.
        </p>
      ) : null}

      <header className="english-page__hero">
        <h1 className="english-page__lesson-title">{formatEnglishLessonLabel(today.current_day)}</h1>
        {lesson ? (
          <p className="english-page__lesson-meta">{formatLessonDuration(playerDurationSec ?? lesson.duration_sec)}</p>
        ) : null}
        <div className="english-page__course-progress" aria-hidden="true">
          <div className="english-page__course-progress-track">
            <div
              className="english-page__course-progress-fill"
              style={{ width: `${Math.max(4, progressPercent)}%` }}
            />
          </div>
        </div>
      </header>

      {dayStatus === "success" ? (
        <section className="english-page__status-card english-page__status-card--success" aria-live="polite">
          <span className="english-page__status-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="english-page__status-title">Урок пройден</p>
            <p className="english-page__status-text">
              Завтра откроется {formatEnglishLessonLabel(today.preview_next_day)}. Сегодня можно пересмотреть
              видео.
            </p>
          </div>
        </section>
      ) : null}

      {dayStatus === "skipped" ? (
        <section className="english-page__status-card english-page__status-card--skip" aria-live="polite">
          <span className="english-page__status-icon" aria-hidden="true">
            ↷
          </span>
          <div>
            <p className="english-page__status-title">Пропущено сегодня</p>
            <p className="english-page__status-text">
              Номер урока не изменился — завтра снова {formatEnglishLessonLabel(today.current_day)}.
            </p>
          </div>
        </section>
      ) : null}

      {lesson && videoId ? (
        <section className="english-page__video-section" aria-label="Видеоурок">
          <YouTubeLessonPlayer
            videoId={videoId}
            durationSec={lesson.duration_sec}
            onDurationReady={setPlayerDurationSec}
            onWatchProgress={handleWatchProgress}
            onVideoEnded={handleVideoEnded}
          />

          {!isFinishedToday ? (
            <div className="english-page__watch-card">
              <div className="english-page__watch-row">
                <span className="english-page__watch-label">Прогресс просмотра</span>
                <span className="english-page__watch-value">{watchProgress}%</span>
              </div>
              <div className="english-page__watch-track" aria-hidden="true">
                <div
                  className="english-page__watch-fill"
                  style={{ width: `${watchProgress}%` }}
                />
              </div>
              <p className="english-page__watch-hint">
                {complete.isPending
                  ? "Сохраняем…"
                  : watchProgress >= 100
                    ? "Урок засчитывается…"
                    : `Осталось ~${formatLessonDuration(Math.max(0, requiredWatchSec - watchedSec))}`}
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="english-page__placeholder english-page__placeholder--error" role="alert">
          Не удалось открыть видео урока.
        </p>
      )}

      {actionError ? (
        <p className="english-page__error" role="alert">
          {actionError}
        </p>
      ) : null}

      {!isFinishedToday ? (
        <div className="english-page__actions">
          <button
            type="button"
            className="english-page__btn english-page__btn--ghost english-page__btn--wide"
            disabled={skip.isPending}
            onClick={() => setSkipConfirmOpen(true)}
          >
            Пропустить сегодня
          </button>
        </div>
      ) : null}

      {history && history.items.length > 0 ? (
        <section className="english-page__history" aria-labelledby="english-history-heading">
          <h2 id="english-history-heading" className="english-page__history-title">
            Пройденные уроки
          </h2>
          <ul className="english-page__history-list">
            {history.items.slice(0, 8).map((item) => (
              <li key={item.date} className="english-page__history-item">
                <span className="english-page__history-day">
                  {item.lesson ? formatEnglishLessonLabel(item.lesson.day_number) : "Урок"}
                </span>
                <span className="english-page__history-date">{formatDisplayDate(item.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {skipConfirmOpen ? (
        <div className="english-page__dialog-backdrop" role="presentation" onClick={() => setSkipConfirmOpen(false)}>
          <div
            className="english-page__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="english-skip-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="english-skip-title" className="english-page__dialog-title">
              Пропустить урок?
            </h2>
            <p className="english-page__dialog-text">
              Пропуск не продвигает номер урока. В неделю доступно не больше 2 пропусков.
            </p>
            <div className="english-page__dialog-actions">
              <button
                type="button"
                className="english-page__btn english-page__btn--ghost"
                onClick={() => setSkipConfirmOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="english-page__btn english-page__btn--warn"
                disabled={skip.isPending}
                onClick={() => void handleSkip()}
              >
                {skip.isPending ? "…" : "Пропустить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </EnglishShell>
  );
}

function EnglishShell({
  children,
  onBack,
}: {
  children: ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="english-page">
      <div className="english-page__glow english-page__glow--blue" aria-hidden="true" />
      <div className="english-page__glow english-page__glow--violet" aria-hidden="true" />
      <div className="english-page__shell">
        <button type="button" className="english-page__back" onClick={onBack}>
          ← Назад
        </button>
        {children}
      </div>
    </div>
  );
}
