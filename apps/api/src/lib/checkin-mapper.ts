import type { Checkin } from "../db/schema/index.js";
import type { CheckinResponse } from "@mytodo/shared";

function toNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  return Number(value);
}

export function toCheckinResponse(
  checkin: Checkin,
  currentGoal: number,
  previewNextGoal: number,
): CheckinResponse {
  return {
    id: checkin.id,
    habit_id: checkin.habitId,
    date: checkin.date,
    status: checkin.status as CheckinResponse["status"],
    value: toNumber(checkin.value),
    updated_at: checkin.updatedAt.toISOString(),
    current_goal: currentGoal,
    preview_next_goal: previewNextGoal,
  };
}
