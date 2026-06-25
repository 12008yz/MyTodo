import type { HabitSessionResponse, HabitUnit } from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import { completeSession, getActiveSession, stopSession } from "./session-api";

export const MIN_STALE_SESSION_SECONDS = 5;

export function getSessionElapsedSeconds(session: HabitSessionResponse): number {
  const startedAt = new Date(session.started_at).getTime();
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

export function isActiveSessionConflict(error: unknown): boolean {
  return error instanceof ClientApiError && error.status === 409;
}

export async function finalizeInterruptedSession(
  habitId: string,
  unit: HabitUnit,
): Promise<"completed" | "stopped" | "none" | "kept"> {
  const { session } = await getActiveSession(habitId);
  if (!session) {
    return "none";
  }

  const elapsedSeconds = getSessionElapsedSeconds(session);
  if (elapsedSeconds < MIN_STALE_SESSION_SECONDS) {
    await stopSession(habitId);
    return "stopped";
  }

  if (unit === "minutes") {
    await completeSession(habitId, {
      ...(session.block_id ? { block_id: session.block_id } : {}),
      ended_early: true,
    });
    return "completed";
  }

  return "kept";
}

export async function fetchActiveSession(habitId: string): Promise<HabitSessionResponse | null> {
  const { session } = await getActiveSession(habitId);
  return session;
}
