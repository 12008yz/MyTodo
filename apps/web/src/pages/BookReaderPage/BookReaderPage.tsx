import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { TodayLightResponse } from "@mytodo/shared";
import {
  clampBookPage,
  fetchBookManifest,
  fetchBookPage,
  type BookManifest,
} from "../../features/books/bookContent";
import { useTodayDashboard } from "../../features/today/useTodayData";
import {
  bookPagesRemainingFromPosition,
  pagesReadTodayInBook,
} from "../../features/books/bookReadingProgress";
import {
  booksPagesRemainingForToday,
  formatBookReadingMinutesLabel,
  formatBooksDailyProgressLabel,
  formatSessionCountdown,
  useSyncedReadingTimer,
} from "../../features/books/bookReadingTimer";
import { createCheckin, updateReadingBookmark } from "../../lib/api";
import { patchBooksHabitOnToday } from "../../features/books/bookTodayCache";
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

  const [manifest, setManifest] = useState<BookManifest | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const [dayStartPage, setDayStartPage] = useState<number | null>(null);
  const [localPagesToday, setLocalPagesToday] = useState(0);
  const [pageText, setPageText] = useState("");
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dayStartPageRef = useRef<number | null>(null);
  const dayBaselineReadyRef = useRef(false);
  const dayBaselinePersistedRef = useRef(false);
  const lastCreditedPagesRef = useRef<number | null>(null);
  const checkinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCheckinRef = useRef<{ habitId: string; planDate: string; value: number } | null>(
    null,
  );

  const pageCount = manifest?.pageCount ?? reading?.page_count ?? 1;
  const dailyGoal = habit?.template_id === "books" ? habit.current_goal : 0;
  const effectiveDayStart = dayStartPage ?? dayStartPageRef.current;
  const pagesFromCurrentPage =
    page != null && effectiveDayStart != null
      ? pagesReadTodayInBook(page, effectiveDayStart)
      : null;
  const pagesReadTodayLive = Math.max(
    pagesFromCurrentPage ?? localPagesToday,
    habit?.checkin?.value ?? 0,
    reading?.last_checkin_date === planDate ? (reading.pages_credited_today ?? 0) : 0,
  );
  const pagesRemainingForTimer = booksPagesRemainingForToday(pagesReadTodayLive, dailyGoal);
  const readingTimerDone = dailyGoal > 0 && pagesReadTodayLive >= dailyGoal;
  const bookPagesLeft =
    page != null && pageCount > 0 ? bookPagesRemainingFromPosition(page, pageCount) : 0;
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
    pagesRemaining: pagesRemainingForTimer,
    sessionKey: timerSessionKey,
    enabled: pagesRemainingForTimer > 0 && Boolean(reading),
    onPersist: persistTimer,
  });

  useEffect(() => {
    setPage(null);
    setDayStartPage(null);
    setLocalPagesToday(0);
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
    if (!reading || !manifest || page != null || !planDate) {
      return;
    }

    const initialPage = clampBookPage(reading.last_read_page ?? 1, manifest.pageCount);
    let initialDayStart = dayStartPageRef.current;

    if (reading.reader_day_date === planDate && reading.reader_day_start_page != null) {
      initialDayStart = reading.reader_day_start_page;
      dayStartPageRef.current = initialDayStart;
      setDayStartPage(initialDayStart);
      dayBaselineReadyRef.current = true;
      dayBaselinePersistedRef.current = true;
    }

    setLocalPagesToday(
      initialDayStart != null ? pagesReadTodayInBook(initialPage, initialDayStart) : 0,
    );
    setPage(initialPage);
    if (habitId && initialDayStart != null) {
      const pagesToday = pagesReadTodayInBook(initialPage, initialDayStart);
      const currentCheckin = habit?.checkin?.value ?? 0;
      patchBooksHabitOnToday(queryClient, habitId, {
        lastReadPage: initialPage,
        ...(pagesToday > currentCheckin ? { checkinValue: pagesToday } : {}),
      });
    }
  }, [habit, habitId, queryClient, reading, manifest, page, planDate]);

  const syncReaderProgress = useCallback(
    (nextPage: number) => {
      if (!habitId) {
        return;
      }

      const dayStart = dayStartPageRef.current;
      const patch: Parameters<typeof patchBooksHabitOnToday>[2] = {
        lastReadPage: nextPage,
      };

      if (dayStart != null) {
        const pagesToday = pagesReadTodayInBook(nextPage, dayStart);
        setLocalPagesToday(pagesToday);
        const currentCheckin =
          queryClient
            .getQueryData<TodayLightResponse>(["today", "light"])
            ?.habits.find((row) => row.id === habitId)?.checkin?.value ?? 0;
        if (pagesToday > currentCheckin) {
          patch.checkinValue = pagesToday;
        }
      }

      patchBooksHabitOnToday(queryClient, habitId, patch);
    },
    [habitId, queryClient],
  );

  useEffect(() => {
    if (!bookId || page == null) {
      return;
    }

    let cancelled = false;
    setIsPageLoading(true);
    setLoadError(null);

    void fetchBookPage(bookId, page)
      .then((text) => {
        if (cancelled) {
          return;
        }
        setPageText(text);
        requestAnimationFrame(() => {
          if (!cancelled) {
            setIsPageLoading(false);
          }
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Не удалось загрузить страницу");
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
      setDayStartPage(reading.reader_day_start_page);
      dayBaselineReadyRef.current = true;
      dayBaselinePersistedRef.current = true;
      return;
    }

    if (dayBaselinePersistedRef.current) {
      return;
    }

    const startPage = reading.last_read_page ?? 1;
    dayStartPageRef.current = startPage;
    setDayStartPage(startPage);
    dayBaselineReadyRef.current = true;
    dayBaselinePersistedRef.current = true;
    setLocalPagesToday(
      page != null ? pagesReadTodayInBook(page, startPage) : pagesReadTodayInBook(startPage, startPage),
    );

    void updateReadingBookmark(habitId, {
      reader_day_start_page: startPage,
      reader_day_date: planDate,
    }).then(() => {
      patchBooksHabitOnToday(queryClient, habitId, {
        readerDayStartPage: startPage,
        readerDayDate: planDate,
      });
      if (page != null) {
        syncReaderProgress(page);
      }
    });
  }, [habit, habitId, page, planDate, queryClient, reading, syncReaderProgress]);

  useEffect(() => {
    const serverValue = habit?.checkin?.value ?? 0;
    if (lastCreditedPagesRef.current == null || serverValue > lastCreditedPagesRef.current) {
      lastCreditedPagesRef.current = serverValue;
    }
  }, [habit?.checkin?.value]);

  const habitRef = useRef(habit);
  habitRef.current = habit;

  useEffect(() => {
    const currentHabit = habitRef.current;
    if (
      !habitId ||
      !currentHabit ||
      currentHabit.template_id !== "books" ||
      page == null ||
      !planDate ||
      !dayBaselineReadyRef.current ||
      dayStartPageRef.current == null
    ) {
      return;
    }

    const dayStartPage = dayStartPageRef.current;
    const pagesFromReader = pagesReadTodayInBook(page, dayStartPage);
    const serverValue = currentHabit.checkin?.value ?? 0;
    const nextValue = Math.max(serverValue, lastCreditedPagesRef.current ?? 0, pagesFromReader);

    if (nextValue <= Math.max(lastCreditedPagesRef.current ?? 0, serverValue)) {
      return;
    }

    pendingCheckinRef.current = { habitId, planDate, value: nextValue };
    patchBooksHabitOnToday(queryClient, habitId, { checkinValue: nextValue });

    if (checkinDebounceRef.current) {
      window.clearTimeout(checkinDebounceRef.current);
    }

    checkinDebounceRef.current = window.setTimeout(() => {
      void createCheckin({
        habit_id: habitId,
        date: planDate,
        value: nextValue,
      })
        .then((response) => {
          lastCreditedPagesRef.current = nextValue;
          pendingCheckinRef.current = null;
          patchBooksHabitOnToday(queryClient, habitId, {
            checkinValue: response.value ?? nextValue,
          });
        })
        .catch(() => {
          // Повторим при следующем перелистывании.
        });
    }, 400);

    return () => {
      if (checkinDebounceRef.current) {
        window.clearTimeout(checkinDebounceRef.current);
        checkinDebounceRef.current = null;
      }
    };
  }, [habitId, page, planDate, queryClient]);

  useEffect(() => {
    return () => {
      const hadPendingTimer = checkinDebounceRef.current != null;
      if (checkinDebounceRef.current) {
        window.clearTimeout(checkinDebounceRef.current);
        checkinDebounceRef.current = null;
      }

      const pending = pendingCheckinRef.current;
      if (!pending || !hadPendingTimer) {
        return;
      }

      void createCheckin({
        habit_id: pending.habitId,
        date: pending.planDate,
        value: pending.value,
      }).catch(() => {
        // Страница уже закрыта — сохранится при следующем открытии.
      });
    };
  }, []);

  const persistBookmark = useCallback(
    async (nextPage: number) => {
      if (!habitId) {
        return;
      }
      try {
        await updateReadingBookmark(habitId, {
          last_read_page: nextPage,
        });
      } catch {
        // Закладка сохранится при следующей попытке.
      }
    },
    [habitId],
  );

  useEffect(() => {
    if (!habitId || page == null) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistBookmark(page);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [habitId, page, persistBookmark]);

  const goToPage = useCallback(
    (next: number) => {
      const clamped = clampBookPage(next, pageCount);
      setPage(clamped);
      syncReaderProgress(clamped);
    },
    [pageCount, syncReaderProgress],
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

  if (!habitId) {
    return (
      <div className="book-reader">
        <p className="book-reader__status">Привычка не найдена</p>
      </div>
    );
  }

  if (isTodayLoading && !habit) {
    return (
      <div className="book-reader">
        <p className="book-reader__status">Загрузка…</p>
      </div>
    );
  }

  if (!habit || habit.template_id !== "books") {
    return (
      <div className="book-reader book-reader--fallback">
        <p className="book-reader__status book-reader__error">Это не привычка чтения книг</p>
        <button type="button" className="book-reader__back" onClick={() => navigate("/")}>
          На главную
        </button>
      </div>
    );
  }

  if (!reading || !bookId) {
    return (
      <div className="book-reader book-reader--fallback">
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
              ? "Дневная цель выполнена — можно читать дальше"
              : `Осталось примерно ${pagesRemainingForTimer} стр. до плана на сегодня`
          }
        >
          <span className="book-reader__timer-value">
            {readingTimerDone ? "✓" : formatSessionCountdown(readingTimerSeconds)}
          </span>
          <span className="book-reader__timer-label">
            {formatBooksDailyProgressLabel(pagesReadTodayLive, dailyGoal)}
            {bookPagesLeft > 0 ? ` · ${formatBookReadingMinutesLabel(bookPagesLeft)}` : ""}
          </span>
        </div>
      </header>

      <div className="book-reader__stage" ref={stageRef}>
        <main className="book-reader__main">
          {loadError ? <p className="book-reader__error">{loadError}</p> : null}
          {page != null ? (
            <>
              <p className="book-reader__page-label">
                Страница {page} из {pageCount}
              </p>
              <div
                className={[
                  "book-reader__text-wrap",
                  isPageLoading ? "book-reader__text-wrap--loading" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p className="book-reader__text">{pageText || "\u00a0"}</p>
              </div>
            </>
          ) : null}
        </main>
      </div>

      <footer className="book-reader__footer">
        <div className="book-reader__nav">
          <button
            type="button"
            className="book-reader__nav-btn"
            disabled={page == null || page <= 1}
            onClick={goPrev}
          >
            ← Пред. стр.
          </button>
          <button
            type="button"
            className="book-reader__nav-btn"
            disabled={page == null || page >= pageCount}
            onClick={goNext}
          >
            След. стр. →
          </button>
        </div>
      </footer>
    </div>
  );
}
