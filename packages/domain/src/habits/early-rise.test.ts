import { describe, expect, it } from "vitest";
import { computeEarlyRiseWindowState, formatEarlyRiseCountdown, isEarlyRiseEnforcementActive, isWeekendDate } from "./early-rise.js";

describe("isWeekendDate", () => {
  it("detects Saturday and Sunday", () => {
    expect(isWeekendDate("2026-06-27")).toBe(true);
    expect(isWeekendDate("2026-06-28")).toBe(true);
    expect(isWeekendDate("2026-06-29")).toBe(false);
  });
});

describe("computeEarlyRiseWindowState", () => {
  const timezone = "Europe/Moscow";

  it("is before the window until target wake time", () => {
    const now = new Date("2026-06-28T03:59:30.000Z"); // 06:59:30 Moscow

    expect(computeEarlyRiseWindowState("07:00", 0, now, timezone)).toEqual({
      phase: "before",
      target_wake_time: "07:00",
      window_end_time: "07:05",
      seconds_remaining: 0,
      seconds_until_window: 30,
    });
  });

  it("opens a 5-minute confirmation window at target wake time", () => {
    const now = new Date("2026-06-28T04:02:00.000Z"); // 07:02 Moscow

    expect(computeEarlyRiseWindowState("07:00", 0, now, timezone)).toEqual({
      phase: "window",
      target_wake_time: "07:00",
      window_end_time: "07:05",
      seconds_remaining: 180,
      seconds_until_window: 0,
    });
  });

  it("respects the early-rise shift when computing target time", () => {
    const now = new Date("2026-06-28T03:56:00.000Z"); // 06:56 Moscow

    expect(computeEarlyRiseWindowState("07:00", 5, now, timezone).phase).toBe("window");
    expect(computeEarlyRiseWindowState("07:00", 5, now, timezone).target_wake_time).toBe("06:55");
  });

  it("expires after the confirmation window", () => {
    const now = new Date("2026-06-28T04:05:00.000Z"); // 07:05 Moscow

    expect(computeEarlyRiseWindowState("07:00", 0, now, timezone)).toEqual({
      phase: "expired",
      target_wake_time: "07:00",
      window_end_time: "07:05",
      seconds_remaining: 0,
      seconds_until_window: 0,
    });
  });
});

describe("isEarlyRiseEnforcementActive", () => {
  const timezone = "Europe/Moscow";
  const createdAt = new Date("2026-06-28T08:00:00.000Z"); // 11:00 Moscow

  it("is inactive on the registration day after morning", () => {
    expect(isEarlyRiseEnforcementActive(createdAt, "2026-06-28", timezone)).toBe(false);
  });

  it("is inactive on Saturday and Sunday", () => {
    const weekdayAnchor = new Date("2026-06-25T08:00:00.000Z"); // Wednesday
    expect(isEarlyRiseEnforcementActive(weekdayAnchor, "2026-06-27", timezone)).toBe(false); // Saturday
    expect(isEarlyRiseEnforcementActive(weekdayAnchor, "2026-06-28", timezone)).toBe(false); // Sunday
  });

  it("is active on Monday after weekend", () => {
    const weekdayAnchor = new Date("2026-06-25T08:00:00.000Z");
    expect(isEarlyRiseEnforcementActive(weekdayAnchor, "2026-06-29", timezone)).toBe(true);
  });

  it("is active on warmup day for pre-dawn signup before 00:50 on a weekday", () => {
    const preDawn = new Date("2026-06-25T21:10:00.000Z"); // 00:10 Moscow, Friday 2026-06-26
    expect(isEarlyRiseEnforcementActive(preDawn, "2026-06-26", timezone)).toBe(true);
  });

  it("is inactive on warmup day after 00:50 local signup on a weekday", () => {
    const lateNight = new Date("2026-06-25T21:55:00.000Z"); // 00:55 Moscow, Friday 2026-06-26
    expect(isEarlyRiseEnforcementActive(lateNight, "2026-06-26", timezone)).toBe(false);
  });

  it("is active from the next local day", () => {
    expect(isEarlyRiseEnforcementActive(createdAt, "2026-06-29", timezone)).toBe(true);
  });
});

describe("formatEarlyRiseCountdown", () => {
  it("formats mm:ss", () => {
    expect(formatEarlyRiseCountdown(0)).toBe("00:00");
    expect(formatEarlyRiseCountdown(65)).toBe("01:05");
    expect(formatEarlyRiseCountdown(300)).toBe("05:00");
  });
});
