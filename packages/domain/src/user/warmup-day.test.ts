import { describe, expect, it } from "vitest";
import {
  isHabitEnforcementActive,
  isWarmupDay,
  isWarmupPreDawnSignup,
  resolveDayStartSlot,
  resolveWarmupAnchor,
  resolveWarmupDayInfo,
  resolveWarmupDaySlot,
} from "./warmup-day.js";

const timezone = "Europe/Moscow";

describe("resolveWarmupAnchor", () => {
  it("prefers onboarding completion over registration", () => {
    const registered = new Date("2026-06-27T08:00:00.000Z");
    const completed = new Date("2026-06-28T20:00:00.000Z");
    expect(resolveWarmupAnchor(completed, registered)).toBe(completed);
  });

  it("falls back to registration when onboarding timestamp is missing", () => {
    const registered = new Date("2026-06-27T08:00:00.000Z");
    expect(resolveWarmupAnchor(null, registered)).toBe(registered);
  });
});

describe("isWarmupDay", () => {
  const anchor = new Date("2026-06-28T20:45:00.000Z");

  it("is active on the anchor calendar day", () => {
    expect(isWarmupDay(anchor, "2026-06-28", timezone)).toBe(true);
  });

  it("is inactive from the next calendar day", () => {
    expect(isWarmupDay(anchor, "2026-06-29", timezone)).toBe(false);
  });
});

describe("isHabitEnforcementActive", () => {
  const anchor = new Date("2026-06-28T20:45:00.000Z");

  it("is false on warmup day", () => {
    expect(isHabitEnforcementActive(anchor, "2026-06-28", timezone)).toBe(false);
  });

  it("is true after warmup day", () => {
    expect(isHabitEnforcementActive(anchor, "2026-06-29", timezone)).toBe(true);
  });
});

describe("resolveDayStartSlot", () => {
  it("classifies late-night onboarding as night", () => {
    const moment = new Date("2026-06-28T20:45:00.000Z");
    expect(resolveDayStartSlot(moment, timezone, "07:00", "23:00")).toBe("night");
  });

  it("classifies morning onboarding as morning", () => {
    const moment = new Date("2026-06-28T05:00:00.000Z");
    expect(resolveDayStartSlot(moment, timezone, "07:00", "23:00")).toBe("morning");
  });

  it("uses fixed buckets without wake and sleep", () => {
    const afternoon = new Date("2026-06-28T10:00:00.000Z");
    expect(resolveDayStartSlot(afternoon, timezone)).toBe("day");
  });
});

describe("resolveWarmupDayInfo", () => {
  it("returns inactive info when plan date is after warmup", () => {
    const info = resolveWarmupDayInfo({
      onboardingCompletedAt: new Date("2026-06-28T20:45:00.000Z"),
      registeredAt: new Date("2026-06-28T18:00:00.000Z"),
      planDate: "2026-06-29",
      timezone,
      wakeTime: "07:00",
      sleepTime: "23:00",
    });

    expect(info).toEqual({ active: false, slot: "morning", earlyRiseEnforcement: false });
  });

  it("returns active night slot for late onboarding", () => {
    const completedAt = new Date("2026-06-28T20:45:00.000Z");
    const info = resolveWarmupDayInfo({
      onboardingCompletedAt: completedAt,
      registeredAt: new Date("2026-06-28T18:00:00.000Z"),
      planDate: "2026-06-28",
      timezone,
      wakeTime: "07:00",
      sleepTime: "23:00",
    });

    expect(info.active).toBe(true);
    expect(info.slot).toBe("night");
    expect(info.earlyRiseEnforcement).toBe(false);
  });

  it("keeps morning wake on pre-dawn signup before 00:50", () => {
    const completedAt = new Date("2026-06-27T21:10:00.000Z"); // 00:10 Moscow
    const info = resolveWarmupDayInfo({
      onboardingCompletedAt: completedAt,
      registeredAt: completedAt,
      planDate: "2026-06-28",
      timezone,
      wakeTime: "07:00",
      sleepTime: "23:00",
    });

    expect(info.active).toBe(true);
    expect(info.slot).toBe("morning");
    expect(info.earlyRiseEnforcement).toBe(true);
    expect(isWarmupPreDawnSignup(completedAt, timezone)).toBe(true);
  });

  it("treats signup at 00:50 and later as night rest on warmup day", () => {
    const completedAt = new Date("2026-06-27T21:55:00.000Z"); // 00:55 Moscow
    const info = resolveWarmupDayInfo({
      onboardingCompletedAt: completedAt,
      registeredAt: completedAt,
      planDate: "2026-06-28",
      timezone,
      wakeTime: "07:00",
      sleepTime: "23:00",
    });

    expect(info.active).toBe(true);
    expect(info.slot).toBe("night");
    expect(info.earlyRiseEnforcement).toBe(false);
    expect(resolveWarmupDaySlot(completedAt, timezone, "07:00", "23:00")).toBe("night");
  });
});
