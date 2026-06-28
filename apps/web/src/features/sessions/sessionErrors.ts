import { ClientApiError } from "../../lib/api";

const SESSION_ERROR_MESSAGES: Record<string, string> = {
  "Session is too short to complete": "Сессия слишком короткая — подождите ещё несколько секунд",
  "No active habit session for this habit": "Активная сессия не найдена — попробуйте начать заново",
  "Habit session already active for this habit": "Сессия уже запущена",
  "Habit not found": "Привычка не найдена",
  "Habit sessions are not available for this habit": "Для этой привычки таймер недоступен",
  "Habit session was already completed or stopped": "Сессия уже завершена",
  "actual_value must be greater than zero for non-minute habits":
    "Укажите результат больше нуля",
  "actual_value must be zero or greater for limit habits":
    "Укажите значение не меньше нуля",
  "Computed minutes must be greater than zero": "Не удалось посчитать минуты сессии",
  "Cannot add session value on a skipped day": "Нельзя отметить выполнение в пропущенный день",
  "Сессия слишком короткая — подождите ещё несколько секунд":
    "Сессия слишком короткая — подождите ещё несколько секунд",
  "Активная сессия не найдена": "Активная сессия не найдена — попробуйте начать заново",
  "Сессия уже запущена": "Сессия уже запущена",
  "Для этой привычки таймер недоступен": "Для этой привычки таймер недоступен",
  "Привычка не найдена": "Привычка не найдена",
};

export function formatSessionError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return SESSION_ERROR_MESSAGES[error.message] ?? error.message;
  }

  if (error instanceof Error) {
    return SESSION_ERROR_MESSAGES[error.message] ?? error.message;
  }

  return "Не удалось выполнить действие";
}
