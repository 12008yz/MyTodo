import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  COACH_DAILY_MESSAGE_LIMIT,
  COACH_QUICK_REPLIES,
  type CoachChatResponse,
  type HarshnessLevel,
  type HabitTemplateId,
} from "@mytodo/shared";
import { useAuth } from "../auth/AuthProvider";
import { ClientApiError, sendCoachChat } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";
import { buildLocalCoachReply, formatCoachError } from "./coachReply";
import "./DarkCoachSheet.css";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type DarkCoachSheetProps = {
  open: boolean;
  habitId: string;
  habitName: string;
  templateId: HabitTemplateId | string | null;
  onClose: () => void;
};

function resolveHarshness(level: number | undefined): HarshnessLevel {
  return Math.min(3, Math.max(1, level ?? 1)) as HarshnessLevel;
}

export function DarkCoachSheet({
  open,
  habitId,
  habitName,
  templateId,
  onClose,
}: DarkCoachSheetProps) {
  const { user } = useAuth();
  const harshness = resolveHarshness(user?.harshness_level);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [messagesLeft, setMessagesLeft] = useState(COACH_DAILY_MESSAGE_LIMIT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setInput("");
    setMessagesLeft(COACH_DAILY_MESSAGE_LIMIT);
    setError(null);
    setOfflineMode(false);
    setAiMode(false);
    setMessages([
      {
        role: "assistant",
        text: buildLocalCoachReply(templateId, harshness, "привет"),
      },
    ]);
  }, [open, habitId, templateId, harshness]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.classList.add("dark-coach-sheet-open");
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("dark-coach-sheet-open");
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, pending]);

  if (!open) {
    return null;
  }

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending || messagesLeft <= 0) {
      return;
    }

    setPending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");

    try {
      let response: CoachChatResponse;

      if (offlineMode) {
        response = {
          reply: buildLocalCoachReply(templateId, harshness, trimmed),
          messages_left: Math.max(0, messagesLeft - 1),
          source: "template",
        };
      } else {
        response = await sendCoachChat({ habit_id: habitId, message: trimmed });
      }

      setMessages((prev) => [...prev, { role: "assistant", text: response.reply }]);
      setMessagesLeft(response.messages_left);
      if (response.source === "template" && !offlineMode && !isDemoMode()) {
        setOfflineMode(true);
      } else if (response.source === "gigachat") {
        setOfflineMode(false);
        setAiMode(true);
      }
    } catch (err) {
      if (err instanceof ClientApiError) {
        if (err.status === 404) {
          setError("Эндпоинт /coach/chat не найден — перезапустите API после обновления кода.");
          return;
        }
        if (err.status === 429) {
          setMessagesLeft(0);
          setError(err.message);
          return;
        }
      }

      const fallback = buildLocalCoachReply(templateId, harshness, trimmed);
      setMessages((prev) => [...prev, { role: "assistant", text: fallback }]);
      setMessagesLeft(Math.max(0, messagesLeft - 1));
      setOfflineMode(true);
      setError(formatCoachError(err));
    } finally {
      setPending(false);
    }
  };

  const sheet = (
    <div className="dark-coach-sheet" role="dialog" aria-modal="true" aria-label="Помощник">
      <button type="button" className="dark-coach-sheet__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div
        className="dark-coach-sheet__panel"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dark-coach-sheet__handle" aria-hidden="true" />

        <header className="dark-coach-sheet__header">
          <div className="dark-coach-sheet__header-main">
            <span className="dark-coach-sheet__avatar" aria-hidden="true">
              ✦
            </span>
            <div className="dark-coach-sheet__header-text">
              <p className="dark-coach-sheet__eyebrow">Помощник</p>
              <h2 className="dark-coach-sheet__title">{habitName}</h2>
            </div>
          </div>
          <button type="button" className="dark-coach-sheet__close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <p className="dark-coach-sheet__limit">
          Осталось {messagesLeft} из {COACH_DAILY_MESSAGE_LIMIT} сообщений сегодня
          {aiMode ? " · GigaChat" : offlineMode ? " · шаблоны" : ""}
        </p>

        <div ref={listRef} className="dark-coach-sheet__messages">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={[
                "dark-coach-sheet__bubble",
                message.role === "user"
                  ? "dark-coach-sheet__bubble--user"
                  : "dark-coach-sheet__bubble--assistant",
              ].join(" ")}
            >
              {message.text}
            </div>
          ))}
          {pending ? <p className="dark-coach-sheet__typing">Печатает…</p> : null}
        </div>

        <footer className="dark-coach-sheet__footer">
          <div className="dark-coach-sheet__quick">
            {COACH_QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                className="dark-coach-sheet__quick-btn"
                disabled={pending || messagesLeft <= 0}
                onClick={() => void sendMessage(reply)}
              >
                {reply}
              </button>
            ))}
          </div>

          {error ? <p className="dark-coach-sheet__error">{error}</p> : null}

          <form
            className="dark-coach-sheet__form"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <input
              className="dark-coach-sheet__input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={messagesLeft > 0 ? "Напиши сообщение…" : "Лимит на сегодня исчерпан"}
              disabled={pending || messagesLeft <= 0}
              maxLength={500}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              type="submit"
              className="dark-coach-sheet__send"
              disabled={pending || messagesLeft <= 0 || !input.trim()}
              aria-label="Отправить"
            >
              →
            </button>
          </form>
        </footer>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
