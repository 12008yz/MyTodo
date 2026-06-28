import { describe, expect, it } from "vitest";
import { computeEarlyRiseWindowState, formatEarlyRiseCountdown, isEarlyRiseEnforcementActive } from "./early-rise.js";

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

  it("is inactive on the registration day", () => {
    expect(isEarlyRiseEnforcementActive(createdAt, "2026-06-28", timezone)).toBe(false);
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
