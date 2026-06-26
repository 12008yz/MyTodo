import type { HabitSessionResponse } from "@mytodo/shared";
import { sessionTotalSeconds } from "@mytodo/shared";
import { ClientApiError } from "../../lib/api";
import { getActiveSession, pauseSession, resumeSession, stopSession } from "./session-api";

export const MIN_STALE_SESSION_SECONDS = 5;

export function getElapsedSecondsFromStart(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

export function getRemainingSecondsFromStart(
  startedAt: string,
  plannedMin: number,
  plannedSeconds?: number | null,
): number {
  const totalSeconds = sessionTotalSeconds({ planned_min: plannedMin, planned_seconds: plannedSeconds });
  const endsAt = new Date(startedAt).getTime() + totalSeconds * 1000;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function getSessionRemainingSeconds(session: HabitSessionResponse): number {
  if (session.is_paused && session.remaining_seconds != null) {
    return session.remaining_seconds;
  }

  return getRemainingSecondsFromStart(
    session.started_at,
    session.planned_min,
    session.planned_seconds,
  );
}

export function getSessionElapsedSeconds(session: HabitSessionResponse): number {
  const totalSeconds = sessionTotalSeconds(session);
  return Math.max(0, totalSeconds - getSessionRemainingSeconds(session));
}

export function isActiveSessionConflict(error: unknown): boolean {
  return error instanceof ClientApiError && error.status === 409;
}

export async function recoverStaleSession(
  habitId: string,
): Promise<{ status: "stopped" | "none" | "kept"; session: HabitSessionResponse | null }> {
  const { session } = await getActiveSession(habitId);
  if (!session) {
    return { status: "none", session: null };
  }

  const elapsedSeconds = getSessionElapsedSeconds(session);
  if (elapsedSeconds < MIN_STALE_SESSION_SECONDS) {
    await stopSession(habitId);
    return { status: "stopped", session: null };
  }

  return { status: "kept", session };
}

export async function fetchActiveSession(habitId: string): Promise<HabitSessionResponse | null> {
  const { session } = await getActiveSession(habitId);
  return session;
}

export async function ensurePausedSession(habitId: string): Promise<HabitSessionResponse | null> {
  const session = await fetchActiveSession(habitId);
  if (!session) {
    return null;
  }

  if (session.is_paused) {
    return session;
  }

  return pauseSession(habitId);
}

export async function ensureResumedSession(habitId: string): Promise<HabitSessionResponse | null> {
  const session = await fetchActiveSession(habitId);
  if (!session) {
    return null;
  }

  if (!session.is_paused) {
    return session;
  }

  return resumeSession(habitId);
}
