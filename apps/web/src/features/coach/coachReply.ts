import {
  resolveDarkCoachReply,
  type HarshnessLevel,
  type HabitTemplateId,
} from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";

export function buildLocalCoachReply(
  templateId: HabitTemplateId | string | null | undefined,
  harshnessLevel: HarshnessLevel,
  message: string,
): string {
  return resolveDarkCoachReply(templateId, harshnessLevel, message);
}

export function isCoachNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) {
    return true;
  }
  if (err instanceof Error && /fetch|network|failed/i.test(err.message)) {
    return true;
  }
  return false;
}

export function formatCoachError(err: unknown): string {
  if (err instanceof ClientApiError) {
    return err.message;
  }
  if (isCoachNetworkError(err)) {
    return "Сервер не отвечает. Запустите pnpm dev (API + Docker) или откройте демо: pnpm dev:demo";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Не удалось отправить сообщение";
}
