import { describe, expect, it } from "vitest";
import { computeAbstinenceElapsed } from "./abstinence-timer.js";

describe("computeAbstinenceElapsed", () => {
  it("splits elapsed time into days, hours, minutes, and seconds", () => {
    const started = new Date("2026-06-15T10:00:00.000Z");
    const now = new Date("2026-06-18T00:22:08.000Z");

    expect(computeAbstinenceElapsed(started, now)).toEqual({
      days: 2,
      hours: 14,
      minutes: 22,
      seconds: 8,
      total_seconds: 224_528,
    });
  });

  it("never returns negative values", () => {
    const started = new Date("2026-06-19T12:00:00.000Z");
    const now = new Date("2026-06-19T10:00:00.000Z");

    expect(computeAbstinenceElapsed(started, now).total_seconds).toBe(0);
  });
});
