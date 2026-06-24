import type {
  CompleteHabitSessionRequest,
  HabitSessionActiveResponse,
  HabitSessionCompleteResponse,
  HabitSessionResponse,
  StartHabitSessionRequest,
} from "@mytodo/shared";
import {
  completeHabitSession,
  getActiveHabitSession,
  startHabitSession,
  stopHabitSession,
} from "../../lib/api";

export function startSession(
  habitId: string,
  payload: StartHabitSessionRequest = {},
): Promise<HabitSessionResponse> {
  return startHabitSession(habitId, payload);
}

export function completeSession(
  habitId: string,
  payload: CompleteHabitSessionRequest = {},
): Promise<HabitSessionCompleteResponse> {
  return completeHabitSession(habitId, payload);
}

export function stopSession(habitId: string): Promise<HabitSessionResponse> {
  return stopHabitSession(habitId);
}

export function getActiveSession(habitId: string): Promise<HabitSessionActiveResponse> {
  return getActiveHabitSession(habitId);
}
