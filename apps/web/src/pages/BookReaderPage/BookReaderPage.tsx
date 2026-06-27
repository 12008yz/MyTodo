import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  clampBookPage,
  fetchBookManifest,
  fetchBookPage,
  type BookManifest,
} from "../../features/books/bookContent";
import { useTodayDashboard } from "../../features/today/useTodayData";
import {
  pagesReadTodayInBook,
} from "../../features/books/bookReadingProgress";
import {
  booksReadingGoalRemainingPages,
  formatBooksReadingTimerLabel,
  formatSessionCountdown,
  useSyncedReadingTimer,
} from "../../features/books/bookReadingTimer";
import { createCheckin, updateReadingBookmark } from "../../lib/api";
import "./BookReaderPage.css";

export function BookReaderPage() {
  const { habitId } = useParams<{ habitId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dashboard, isLoading: isTodayLoading } = useTodayDashboard("light");

  const habit = useMemo(
    () => dashboard?.habits.find((row) => row.id === habitId) ?? null,
    [dashboard?.habits, habitId],
  );
  const reading = habit && "reading" in habit ? habit.reading : null;
  const bookId = reading?.book_id ?? null;
  const planDate = dashboard?.date ?? "";

  const pagesRemainingToday =
    habit && habit.template_id === "books" ? booksReadingGoalRemainingPages(habit) : 0;
  const readingTimerDone = pagesRemainingToday <= 0;
  const timerSessionKey = `${habitId ?? ""}:${bookId ?? ""}:${planDate}`;

  const persistTimer = useCallback(
    async (seconds: number) => {
      if (!habitId || !planDate) {
        return;
      }
      try {
        await updateReadingBookmark(habitId, {
          timer_remaining_seconds: seconds,
          timer_saved_date: planDate,
        });
      } catch {
        // Повторим при следующем сохранении.
      }
    },
    [habitId, planDate],
  );

  const readingTimerSeconds = useSyncedReadingTimer({
    reading,
    planDate,
    pagesRemaining: pagesRemainingToday,
    sessionKey: timerSessionKey,
    enabled: pagesRemainingToday > 0 && Boolean(reading),
    onPersist: persistTimer,
  });

  const [manifest, setManifest] = useState<BookManifest | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const [pageText, setPageText] = useState("");
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wheelLockRef = useRef(false);
  const dayStartPageRef = useRef<number | null>(null);
  const dayBaselineReadyRef = useRef(false);
  const dayBaselinePersistedRef = useRef(false);
  const lastCreditedPagesRef = useRef<number | null>(null);

  useEffect(() => {
    setPage(null);
    dayStartPageRef.current = null;
    dayBaselineReadyRef.current = false;
    dayBaselinePersistedRef.current = false;
    lastCreditedPagesRef.current = null;
  }, [habitId, bookId, planDate]);

  useEffect(() => {
    if (!bookId) {
      return;
    }

    let cancelled = false;
    void fetchBookManifest(bookId)
      .then((data) => {
        if (!cancelled) {
          setManifest(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Не удалось загрузить книгу");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!reading || !manifest || page != null) {
      return;
    }
    setPage(clampBookPage(reading.last_read_page ?? 1, manifest.pageCount));
  }, [reading, manifest, page]);

  useEffect(() => {
    if (!bookId || page == null) {
      return;
    }

    let cancelled = false;
    setIsPageLoading(true);
    setLoadError(null);

    void fetchBookPage(bookId, page)
      .then((text) => {
        if (!cancelled) {
          setPageText(text);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Не удалось загрузить страницу");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookId, page]);

  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    if (!habitId || !reading || !planDate || !habit || habit.template_id !== "books") {
      return;
    }

    if (reading.reader_day_date === planDate && reading.reader_day_start_page != null) {
      dayStartPageRef.current = reading.reader_day_start_page;
      dayBaselineReadyRef.current = true;
      dayBaselinePersistedRef.current = true;
      return;
    }

    if (dayBaselinePersistedRef.current) {
      return;
    }

    const startPage = reading.last_read_page ?? 1;
    dayStartPageRef.current = startPage;
    dayBaselineReadyRef.current = true;
    dayBaselinePersistedRef.current = true;

    void updateReadingBookmark(habitId, {
      reader_day_start_page: startPage,
      reader_day_date: planDate,
    });
  }, [habit, habitId, planDate, reading]);

  useEffect(() => {
    if (
      !habitId ||
      !habit ||
      habit.template_id !== "books" ||
      page == null ||
      !planDate ||
      !dayBaselineReadyRef.current ||
      dayStartPageRef.current == null
    ) {
      return;
    }

    const dayStartPage = dayStartPageRef.current;
    const pagesFromReader = pagesReadTodayInBook(page, dayStartPage, habit.current_goal);
    const currentValue = habit.checkin?.value ?? 0;

    if (lastCreditedPagesRef.current == null) {
      lastCreditedPagesRef.current = currentValue;
    }

    const nextValue = Math.max(lastCreditedPagesRef.current, pagesFromReader);

    if (nextValue <= lastCreditedPagesRef.current) {
      return;
    }

    void createCheckin({
      habit_id: habitId,
      date: planDate,
      value: nextValue,
    }).then(() => {
      lastCreditedPagesRef.current = nextValue;
      void queryClient.invalidateQueries({ queryKey: ["today", "light"] });
    });
  }, [habit, habitId, page, planDate, queryClient]);

  const persistBookmark = useCallback(
    async (nextPage: number) => {
      if (!habitId) {
        return;
      }
      try {
        await updateReadingBookmark(habitId, {
          last_read_page: nextPage,
        });
        await queryClient.invalidateQueries({ queryKey: ["today", "light"] });
      } catch {
        // Закладка сохранится при следующей попытке.
      }
    },
    [habitId, queryClient],
  );

  useEffect(() => {
    const bookmark = reading?.last_read_page ?? 1;
    if (!habitId || page == null || !reading || page === bookmark) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistBookmark(page);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [habitId, page, persistBookmark, reading]);

  const pageCount = manifest?.pageCount ?? reading?.page_count ?? 1;

  const goToPage = useCallback(
    (next: number) => {
      setPage(clampBookPage(next, pageCount));
    },
    [pageCount],
  );

  const goPrev = useCallback(() => {
    if (page == null || page <= 1) {
      return;
    }
    goToPage(page - 1);
  }, [goToPage, page]);

  const goNext = useCallback(() => {
    if (page == null || page >= pageCount) {
      return;
    }
    goToPage(page + 1);
  }, [goToPage, page, pageCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !window.matchMedia("(pointer: fine)").matches) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      if (page == null || isPageLoading || wheelLockRef.current) {
        return;
      }

      if (Math.abs(event.deltaY) < 24) {
        return;
      }

      event.preventDefault();
      wheelLockRef.current = true;
      goToPage(page + (event.deltaY > 0 ? 1 : -1));
      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 450);
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [goToPage, isPageLoading, page]);

  if (!habitId) {
    return <p className="book-reader__status">Привычка не найдена</p>;
  }

  if (isTodayLoading && !habit) {
    return <p className="book-reader__status">Загрузка…</p>;
  }

  if (!habit || habit.template_id !== "books") {
    return (
      <div className="book-reader">
        <p className="book-reader__status book-reader__error">Это не привычка чтения книг</p>
        <button type="button" className="book-reader__back" onClick={() => navigate("/")}>
          На главную
        </button>
      </div>
    );
  }

  if (!reading || !bookId) {
    return (
      <div className="book-reader">
        <p className="book-reader__status">Сначала выберите книгу в плане на сегодня</p>
        <button type="button" className="book-reader__back" onClick={() => navigate("/")}>
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="book-reader">
      <header className="book-reader__header">
        <button type="button" className="book-reader__back" onClick={() => navigate("/")}>
          ← Назад
        </button>
        <div className="book-reader__title-wrap">
          <h1 className="book-reader__title">{manifest?.title ?? "Книга"}</h1>
          {manifest?.author ? <p className="book-reader__author">{manifest.author}</p> : null}
        </div>
        <div
          className={[
            "book-reader__timer",
            readingTimerDone ? "book-reader__timer--done" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
          title={
            readingTimerDone
              ? "Дневная цель по страницам выполнена"
              : `Примерно ${formatBooksReadingTimerLabel(pagesRemainingToday)} до цели на сегодня`
          }
        >
          <span className="book-reader__timer-value">
            {readingTimerDone ? "✓" : formatSessionCountdown(readingTimerSeconds)}
          </span>
          <span className="book-reader__timer-label">
            {formatBooksReadingTimerLabel(pagesRemainingToday)}
          </span>
        </div>
      </header>

      <div className="book-reader__stage" ref={stageRef}>
        <button
          type="button"
          className="book-reader__edge book-reader__edge--prev"
          aria-label="Предыдущая страница"
          disabled={page == null || page <= 1}
          onClick={goPrev}
        />
        <main className="book-reader__main">
          {loadError ? <p className="book-reader__error">{loadError}</p> : null}
          {isPageLoading ? <p className="book-reader__status">Загрузка страницы…</p> : null}
          {!isPageLoading && page != null ? (
            <>
              <p className="book-reader__page-label">
                Страница {page} из {pageCount}
              </p>
              <p className="book-reader__text">{pageText || " "}</p>
            </>
          ) : null}
        </main>
        <button
          type="button"
          className="book-reader__edge book-reader__edge--next"
          aria-label="Следующая страница"
          disabled={page == null || page >= pageCount}
          onClick={goNext}
        />
      </div>

      <footer className="book-reader__footer">
        <div className="book-reader__nav">
          <button
            type="button"
            className="book-reader__nav-btn"
            disabled={page == null || page <= 1}
            onClick={goPrev}
          >
            ← Назад
          </button>
          <button
            type="button"
            className="book-reader__nav-btn"
            disabled={page == null || page >= pageCount}
            onClick={goNext}
          >
            Вперёд →
          </button>
        </div>
      </footer>
    </div>
  );
}
