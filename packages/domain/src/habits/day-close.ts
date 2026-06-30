import { applyDayProgression, type DayStatus, type HabitForProgression } from "./progression.js";
import { usesAbstinenceStreakRules } from "./streak.js";

export type HabitForDayClose = HabitForProgression & {
  phase: string;
  templateId?: string | null;
};

export type CheckinForDayClose = {
  status: string;
  value?: number | null;
};

export type DayCloseOptions = {
  /** User is in silence mode (silence_mode_until > now). */
  silenceMode?: boolean;
  /** Habit has an active pledge — skipped instead of fail in silence mode. */
  hasActivePledge?: boolean;
};

export type DayCloseResult = {
  status: DayStatus;
  value: number | null;
  /** Worker should create or update the checkin row for this day. */
  upsertCheckin: boolean;
  nextGoal: number;
  nextSuccessDaysAtGoal: number;
  nextBaselineValue?: number;
  nextPhase?: string;
  nextType?: HabitForDayClose["type"];
  setLastRelapseAt?: boolean;
};

function isAbstinenceBehavior(habit: HabitForDayClose): boolean {
  return usesAbstinenceStreakRules(
    habit.type,
    habit.phase as "reduction" | "abstinence",
  );
}

function resolveFinalStatus(
  habit: HabitForDayClose,
  checkin: CheckinForDayClose | null | undefined,
  options: DayCloseOptions,
): DayStatus {
  if (options.silenceMode && options.hasActivePledge) {
    return "skipped";
  }

  if (
    options.hasActivePledge &&
    !options.silenceMode &&
    checkin?.status === "skipped"
  ) {
    return "fail";
  }

  if (!checkin) {
    if (isAbstinenceBehavior(habit)) {
      return "success";
    }

    return "fail";
  }

  const { status, value } = checkin;

  if (status === "success" || status === "fail" || status === "skipped") {
    return status;
  }

  if (isAbstinenceBehavior(habit)) {
    return "success";
  }

  if (value == null) {
    return "fail";
  }

  if (habit.type === "target") {
    return value >= habit.currentGoal ? "success" : "fail";
  }

  return value <= habit.currentGoal ? "success" : "fail";
}

function resolveFinalValue(
  habit: HabitForDayClose,
  checkin: CheckinForDayClose | null | undefined,
  status: DayStatus,
): number | null {
  if (checkin?.value != null) {
    return checkin.value;
  }

  if (habit.type === "limit" && status === "fail") {
    return null;
  }

  return null;
}

function smokingPhaseUpdate(
  habit: HabitForDayClose,
  dayStatus: DayStatus,
  nextGoal: number,
): Pick<DayCloseResult, "nextPhase" | "nextType" | "setLastRelapseAt"> {
  if (
    dayStatus === "success" &&
    habit.templateId === "smoking" &&
    habit.phase === "reduction" &&
    nextGoal === 0
  ) {
    return { nextPhase: "abstinence", nextType: "abstinence", setLastRelapseAt: true };
  }

  return {};
}

/** Pure day-close rules for a single habit (§8.3). */
export function closeDayForHabit(
  habit: HabitForDayClose,
  checkin?: CheckinForDayClose | null,
  options: DayCloseOptions = {},
): DayCloseResult {
  const status = resolveFinalStatus(habit, checkin ?? null, options);
  const value = resolveFinalValue(habit, checkin ?? null, status);
  const progression = applyDayProgression(habit, status);
  const nextGoal = progression.nextGoal;
  const hadCheckin = checkin != null;
  const upsertCheckin =
    !hadCheckin || checkin!.status === "pending" || status !== checkin!.status;

  return {
    status,
    value,
    upsertCheckin,
    nextGoal: progression.nextGoal,
    nextSuccessDaysAtGoal: progression.nextSuccessDaysAtGoal,
    nextBaselineValue: progression.nextBaselineValue,
    ...smokingPhaseUpdate(habit, status, nextGoal),
  };
}
