import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BOOK_RECOMMENDATIONS, type BookRecommendation } from "./bookRecommendations";
import {
  buildGeneralBookEstimate,
  formatHabitBookReadingTime,
} from "./bookReadingPlan";
import type { SelectedBook } from "./bookSelection";

const BOOK_PICKER_EXIT_MS = 360;

function bookPickerExitMs(): number {
  if (typeof window === "undefined") {
    return BOOK_PICKER_EXIT_MS;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : BOOK_PICKER_EXIT_MS;
}

function getHomePortalRoot(): HTMLElement {
  return document.querySelector(".home") ?? document.body;
}

type BookPickerModalProps = {
  isOpen: boolean;
  selectedBookId: string | null;
  onClose: () => void;
  onSelect: (book: SelectedBook | null) => void;
};

export function BookPickerModal({
  isOpen,
  selectedBookId,
  onClose,
  onSelect,
}: BookPickerModalProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [openEpoch, setOpenEpoch] = useState(0);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    setPortalRoot(getHomePortalRoot());
  }, []);

  useEffect(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (isOpen) {
      setMounted(true);
      setExiting(false);
      setOpenEpoch((epoch) => epoch + 1);
      return;
    }

    if (mounted) {
      setExiting(true);
    }
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!exiting) {
      return;
    }

    const duration = bookPickerExitMs();
    if (duration === 0) {
      setMounted(false);
      setExiting(false);
      return;
    }

    exitTimerRef.current = setTimeout(() => {
      setMounted(false);
      setExiting(false);
      exitTimerRef.current = null;
    }, duration);

    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [exiting]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const home = document.querySelector(".home");
    if (!(home instanceof HTMLElement)) {
      return;
    }

    home.classList.add("home--scroll-locked");

    return () => {
      home.classList.remove("home--scroll-locked");
    };
  }, [mounted]);

  useEffect(() => {
    if (!isOpen) {
      setPendingId(null);
    }
  }, [isOpen]);

  if (!mounted || !portalRoot) {
    return null;
  }

  const handleToggle = (book: BookRecommendation) => {
    if (book.id === selectedBookId) {
      setPendingId(book.id);
      onSelect(null);
      onClose();
      return;
    }

    setPendingId(book.id);
    onSelect({ id: book.id, title: book.title, author: book.author });
    onClose();
  };

  return createPortal(
    <div
      key={openEpoch}
      className={[
        "home__value-prompt",
        "home__value-prompt--book-picker",
        exiting ? "home__value-prompt--book-picker-exit" : "home__value-prompt--book-picker-enter",
      ].join(" ")}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="home__value-prompt-panel home__book-picker-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="book-picker-title" className="home__value-prompt-title">
          Выбрать книгу
        </h3>

        <ul className="home__book-picker-list">
          {BOOK_RECOMMENDATIONS.map((book) => {
            const isSelected = book.id === selectedBookId;
            const isPending = book.id === pendingId;
            const estimate = buildGeneralBookEstimate(book.pageCount);

            return (
              <li key={book.id} className="home__book-picker-item">
                <img
                  className="home__book-picker-cover"
                  src={book.coverUrl}
                  alt={book.title}
                  loading="lazy"
                  width={72}
                  height={108}
                />
                <div className="home__book-picker-item-main">
                  <p className="home__book-picker-title">{book.title}</p>
                  <p className="home__book-picker-author">{book.author}</p>
                  <p className="home__book-picker-meta">{formatHabitBookReadingTime(estimate)}</p>
                  <p className="home__book-picker-desc">{book.description}</p>
                </div>
                <div className="home__book-picker-actions">
                  <button
                    type="button"
                    className={[
                      "home__book-picker-select",
                      isSelected ? "home__book-picker-select--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isPending}
                    onClick={() => handleToggle(book)}
                  >
                    {isSelected ? "Снять выбор" : "Выбрать"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="home__value-prompt-actions">
          <button
            type="button"
            className="home__value-prompt-btn home__value-prompt-btn--ghost"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
