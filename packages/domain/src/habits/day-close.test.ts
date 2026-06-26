import { describe, expect, it } from "vitest";
import { closeDayForHabit, type HabitForDayClose } from "./day-close.js";

const lightTarget = (currentGoal: number): HabitForDayClose => ({
  type: "target",
  side: "light",
  currentGoal,
  growthStep: 1,
  progressionDirection: "increase",
  phase: "reduction",
});

const darkLimit = (currentGoal: number, templateId?: string): HabitForDayClose => ({
  type: "limit",
  side: "dark",
  currentGoal,
  growthStep: 1,
  progressionDirection: "decrease",
  phase: "reduction",
  templateId,
});

const abstinence = (): HabitForDayClose => ({
  type: "abstinence",
  side: "dark",
  currentGoal: 0,
  growthStep: 1,
  progressionDirection: "abstain",
  phase: "abstinence",
  templateId: "nails",
});

describe("closeDayForHabit", () => {
  it("marks abstinence without checkin as success", () => {
    expect(closeDayForHabit(abstinence())).toEqual({
      status: "success",
      value: null,
      upsertCheckin: true,
      nextGoal: 0,
      nextSuccessDaysAtGoal: 0,
    });
  });

  it("marks target without checkin as fail", () => {
    expect(closeDayForHabit(lightTarget(10))).toEqual({
      status: "fail",
      value: null,
      upsertCheckin: true,
      nextGoal: 10,
      nextSuccessDaysAtGoal: 0,
    });
  });

  it("marks limit without checkin as fail", () => {
    expect(closeDayForHabit(darkLimit(20))).toEqual({
      status: "fail",
      value: null,
      upsertCheckin: true,
      nextGoal: 20,
      nextSuccessDaysAtGoal: 0,
    });
  });

  it("keeps existing success checkin and advances goal for light habit after interval", () => {
    const habit: HabitForDayClose = {
      ...lightTarget(10),
      progressionIntervalDays: 3,
      successDaysAtGoal: 2,
    };

    expect(
      closeDayForHabit(habit, { status: "success", value: 12 }),
    ).toEqual({
      status: "success",
      value: 12,
      upsertCheckin: false,
      nextGoal: 11,
      nextSuccessDaysAtGoal: 0,
    });
  });

  it("resolves pending limit checkin at close", () => {
    expect(closeDayForHabit(darkLimit(20), { status: "pending", value: 18 })).toEqual({
      status: "success",
      value: 18,
      upsertCheckin: true,
      nextGoal: 19,
      nextSuccessDaysAtGoal: 0,
    });
  });

  it("skips pledge habit in silence mode", () => {
    expect(
      closeDayForHabit(lightTarget(10), null, {
        silenceMode: true,
        hasActivePledge: true,
      }),
    ).toEqual({
      status: "skipped",
      value: null,
      upsertCheckin: true,
      nextGoal: 10,
      nextSuccessDaysAtGoal: 0,
    });
  });

  it("does not skip non-pledge habit in silence mode", () => {
    expect(
      closeDayForHabit(lightTarget(10), null, {
        silenceMode: true,
        hasActivePledge: false,
      }),
    ).toMatchObject({ status: "fail" });
  });

  it("fails pledge habit when checkin is skipped outside silence mode", () => {
    expect(
      closeDayForHabit(lightTarget(10), { status: "skipped", value: null }, {
        silenceMode: false,
        hasActivePledge: true,
      }),
    ).toMatchObject({ status: "fail" });
  });

  it("transitions smoking to abstinence when goal reaches zero after success", () => {
    const smoking: HabitForDayClose = {
      ...darkLimit(1, "smoking"),
      growthStep: 1,
    };

    expect(
      closeDayForHabit(smoking, { status: "success", value: 0 }),
    ).toEqual({
      status: "success",
      value: 0,
      upsertCheckin: false,
      nextGoal: 0,
      nextSuccessDaysAtGoal: 0,
      nextPhase: "abstinence",
      setLastRelapseAt: true,
    });
  });
});
