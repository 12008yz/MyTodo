import { useEffect, useState } from "react";
import { BOOK_RECOMMENDATIONS, type BookRecommendation } from "./bookRecommendations";
import {
  buildGeneralBookEstimate,
  formatHabitBookReadingTime,
} from "./bookReadingPlan";
import type { SelectedBook } from "./bookSelection";

type BookPickerModalProps = {
  isOpen: boolean;
  selectedBookId: string | null;
  onClose: () => void;
  onSelect: (book: SelectedBook) => void;
};

export function BookPickerModal({
  isOpen,
  selectedBookId,
  onClose,
  onSelect,
}: BookPickerModalProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPendingId(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSelect = (book: BookRecommendation) => {
    setPendingId(book.id);
    onSelect({ id: book.id, title: book.title, author: book.author });
    onClose();
  };

  return (
    <div className="home__value-prompt" role="presentation" onClick={onClose}>
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
        <p className="home__value-prompt-hint">
          Бесплатные книги из общественного достояния. Срок — по нашей системе: 5 стр. в день
          на старте, +1 страница каждые 3 успешных дня.
        </p>

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
                  <a
                    className="home__book-picker-link"
                    href={book.ebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {book.ebookLabel ?? "Скачать"}
                  </a>
                  <button
                    type="button"
                    className={[
                      "home__book-picker-select",
                      isSelected ? "home__book-picker-select--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isPending}
                    onClick={() => handleSelect(book)}
                  >
                    {isSelected ? "Выбрано" : "Выбрать"}
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
    </div>
  );
}
