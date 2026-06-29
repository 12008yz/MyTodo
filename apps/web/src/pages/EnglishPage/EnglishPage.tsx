import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ENGLISH_LESSON_COUNT } from "@mytodo/shared";
import { isDemoMode } from "../../lib/demo-mode";
import {
  formatEnglishLessonLabel,
  formatLessonDuration,
  parseVkVideoRef,
  resolveDisplayLessonDuration,
} from "../../features/english/format";
import { useHorizontalSwipe } from "../../features/english/useHorizontalSwipe";
import { useEnglishCatalog, useEnglishMutations, useEnglishToday } from "../../features/english/useEnglish";
import { VkLessonPlayer } from "../../features/english/VkLessonPlayer";
import "./EnglishPage.css";

export function EnglishPage() {
  const navigate = useNavigate();
  const { data: today, isLoading: todayLoading } = useEnglishToday();
  const catalogEnabled = today?.enabled === true;
  const { data: catalog, isLoading: catalogLoading, isError, refetch } = useEnglishCatalog(catalogEnabled);
  const { enable, selectLesson } = useEnglishMutations();

  const [browseIndex, setBrowseIndex] = useState(0);
  const [playerDurationSec, setPlayerDurationSec] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [playerSessionKey, setPlayerSessionKey] = useState(0);
  const syncedCatalogRef = useRef<string | null>(null);

  const lessons = catalog?.lessons ?? [];
  const lesson = lessons[browseIndex] ?? null;
  const vkVideo = lesson ? parseVkVideoRef(lesson.video_url) : null;
  const isOnHomeLesson = catalog
    ? catalog.selected_lesson_id
      ? catalog.selected_lesson_id === lesson?.id
      : lesson?.day_number === catalog.current_day
    : false;

  useEffect(() => {
    if (!catalog || lessons.length === 0) {
      return;
    }

    const syncKey = `${catalog.selected_lesson_id ?? "none"}:${catalog.current_day}`;
    if (syncedCatalogRef.current === syncKey) {
      return;
    }

    syncedCatalogRef.current = syncKey;
    const selectedIndex = catalog.selected_lesson_id
      ? lessons.findIndex((item) => item.id === catalog.selected_lesson_id)
      : lessons.findIndex((item) => item.day_number === catalog.current_day);

    setBrowseIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setPlayerDurationSec(null);
    setPlayerSessionKey(0);
  }, [catalog, lessons]);

  const displayDurationSec = lesson
    ? resolveDisplayLessonDuration(lesson.duration_sec, playerDurationSec)
    : null;

  const goPrev = useCallback(() => {
    setBrowseIndex((index) => Math.max(0, index - 1));
    setPlayerDurationSec(null);
    setPlayerSessionKey((key) => key + 1);
  }, []);

  const goNext = useCallback(() => {
    setBrowseIndex((index) => Math.min(lessons.length - 1, index + 1));
    setPlayerDurationSec(null);
    setPlayerSessionKey((key) => key + 1);
  }, [lessons.length]);

  const swipeHandlers = useHorizontalSwipe({
    onSwipeLeft: browseIndex < lessons.length - 1 ? goNext : undefined,
    onSwipeRight: browseIndex > 0 ? goPrev : undefined,
  });

  const handleEnable = async () => {
    setActionError(null);
    try {
      await enable.mutateAsync();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось включить модуль");
    }
  };

  const handleSelectLesson = async () => {
    if (!lesson) {
      return;
    }

    setActionError(null);
    try {
      await selectLesson.mutateAsync(lesson.id);
      navigate("/");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось выбрать урок");
    }
  };

  if (todayLoading) {
    return (
      <EnglishShell onBack={() => navigate("/profile")}>
        <p className="english-page__placeholder">Загружаем…</p>
      </EnglishShell>
    );
  }

  if (!today?.enabled) {
    return (
      <EnglishShell onBack={() => navigate("/profile")}>
        <div className="english-page__welcome">
          <h1 className="english-page__welcome-title">Английский с нуля</h1>
          <p className="english-page__welcome-lead">
            Выберите уроки в каталоге — смотреть и засчитывать прогресс можно на главной странице.
          </p>
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

  if (catalogLoading) {
    return (
      <EnglishShell onBack={() => navigate("/profile")}>
        <p className="english-page__placeholder">Загружаем каталог…</p>
      </EnglishShell>
    );
  }

  if (isError || !catalog) {
    return (
      <EnglishShell onBack={() => navigate("/profile")}>
        <p className="english-page__placeholder english-page__placeholder--error" role="alert">
          Не удалось загрузить каталог уроков.
        </p>
        <button type="button" className="english-page__btn english-page__btn--primary" onClick={() => void refetch()}>
          Повторить
        </button>
      </EnglishShell>
    );
  }

  if (lessons.length === 0) {
    return (
      <EnglishShell onBack={() => navigate("/profile")}>
        <p className="english-page__placeholder english-page__placeholder--error" role="alert">
          Уроки ещё не загружены. Запустите seed или дождитесь синхронизации каталога.
        </p>
      </EnglishShell>
    );
  }

  const courseProgressPercent = Math.round((catalog.current_day / ENGLISH_LESSON_COUNT) * 100);

  return (
    <EnglishShell onBack={() => navigate("/profile")}>
      {isDemoMode() ? (
        <p className="english-page__demo-banner" role="status">
          Демо-режим — прогресс сохраняется локально.
        </p>
      ) : null}

      <header className="english-page__hero">
        <p className="english-page__catalog-kicker">Каталог курса</p>
        <h1 className="english-page__lesson-title">
          {lesson ? formatEnglishLessonLabel(lesson.day_number) : "Уроки"}
        </h1>
        <p className="english-page__catalog-lead">
          Листайте каталог и выберите урок для главной цели на сегодня. Счётчик задания{" "}
          <strong>обнулится</strong>, для успешного завершения дня{" "}
          <strong>необходимо</strong> выполнить задание.
        </p>
        <p className="english-page__course-counter" aria-live="polite">
          Курс: день {catalog.current_day} из {ENGLISH_LESSON_COUNT}
        </p>
        <div className="english-page__course-progress" aria-hidden="true">
          <div className="english-page__course-progress-track">
            <div
              className="english-page__course-progress-fill"
              style={{ width: `${Math.max(4, courseProgressPercent)}%` }}
            />
          </div>
        </div>
      </header>

      <section
        className="english-page__catalog-card"
        aria-label="Просмотр урока"
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchEnd={swipeHandlers.onTouchEnd}
      >
        <div className="english-page__catalog-nav">
          <button
            type="button"
            className="english-page__catalog-arrow"
            disabled={browseIndex <= 0}
            aria-label="Предыдущий урок"
            onClick={goPrev}
          >
            ‹
          </button>
          <div className="english-page__catalog-nav-copy">
            <p className="english-page__catalog-lesson-title">{lesson?.title}</p>
            {displayDurationSec != null ? (
              <p className="english-page__lesson-meta">{formatLessonDuration(displayDurationSec)}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="english-page__catalog-arrow"
            disabled={browseIndex >= lessons.length - 1}
            aria-label="Следующий урок"
            onClick={goNext}
          >
            ›
          </button>
        </div>

        {lesson?.today_status === "success" ? (
          <p className="english-page__catalog-status english-page__catalog-status--success">
            Сегодня этот урок уже пройден
          </p>
        ) : null}

        {lesson && vkVideo ? (
          <div className="english-page__video-section">
            <VkLessonPlayer
              key={`${vkVideo.oid}:${vkVideo.id}:${playerSessionKey}`}
              video={vkVideo}
              pageUrl={lesson.video_url}
              durationSec={lesson.duration_sec}
              previewOnly
              suppressDoneOverlay
              onDurationReady={setPlayerDurationSec}
              onWatchProgress={() => {}}
            />
          </div>
        ) : (
          <p className="english-page__placeholder english-page__placeholder--error" role="alert">
            Не удалось открыть превью видео.
          </p>
        )}

      </section>

      {actionError ? (
        <p className="english-page__error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="english-page__catalog-footer">
        <button
          type="button"
          className="english-page__btn english-page__btn--primary english-page__btn--wide"
          disabled={!lesson || selectLesson.isPending}
          onClick={() => void handleSelectLesson()}
        >
          {selectLesson.isPending
            ? "Сохраняем…"
            : isOnHomeLesson
              ? "Урок на главной"
              : "Выбрать урок"}
        </button>
      </div>
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
