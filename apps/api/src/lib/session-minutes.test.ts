import { describe, expect, it } from "vitest";
import {
  computeDoomScrollMinutes,
  computeElapsedMinutes,
  computeRemainingSeconds,
} from "./session-minutes.js";

describe("session-minutes", () => {
  it("computeElapsedMinutes rounds partial minutes up", () => {
    const start = new Date("2026-06-19T10:00:00.000Z");
    const end = new Date("2026-06-19T10:05:01.000Z");
    expect(computeElapsedMinutes(start, end)).toBe(6);
  });

  it("computeElapsedMinutes returns zero for non-positive duration", () => {
    const t = new Date("2026-06-19T10:00:00.000Z");
    expect(computeElapsedMinutes(t, t)).toBe(0);
  });

  it("computeRemainingSeconds never goes below zero", () => {
    const endsAt = new Date("2026-06-19T10:00:00.000Z");
    const now = new Date("2026-06-19T10:05:00.000Z");
    expect(computeRemainingSeconds(now, endsAt)).toBe(0);
  });

  it("computeDoomScrollMinutes caps at planned session end", () => {
    const startedAt = new Date("2026-06-19T10:00:00.000Z");
    const plannedEndsAt = new Date("2026-06-19T10:15:00.000Z");
    const actualEnd = new Date("2026-06-19T10:20:00.000Z");
    expect(computeDoomScrollMinutes(startedAt, plannedEndsAt, actualEnd)).toBe(15);
  });

  it("computeDoomScrollMinutes uses actual end when stopping early", () => {
    const startedAt = new Date("2026-06-19T10:00:00.000Z");
    const plannedEndsAt = new Date("2026-06-19T10:15:00.000Z");
    const actualEnd = new Date("2026-06-19T10:05:00.000Z");
    expect(computeDoomScrollMinutes(startedAt, plannedEndsAt, actualEnd)).toBe(5);
  });
});
