import { describe, expect, it } from "vitest";
import { isUserAwake, isUserAwakeAtMinutes, isWakeFlushMinute } from "./awake-window.js";

describe("isUserAwakeAtMinutes", () => {
  it("treats 07:00–23:00 as awake for a typical schedule", () => {
    const wake = 7 * 60;
    const sleep = 23 * 60;

    expect(isUserAwakeAtMinutes(7 * 60, wake, sleep)).toBe(true);
    expect(isUserAwakeAtMinutes(22 * 60 + 30, wake, sleep)).toBe(true);
    expect(isUserAwakeAtMinutes(23 * 60 + 59, wake, sleep)).toBe(false);
    expect(isUserAwakeAtMinutes(3 * 60, wake, sleep)).toBe(false);
  });

  it("supports sleep after midnight", () => {
    const wake = 7 * 60;
    const sleep = 1 * 60;

    expect(isUserAwakeAtMinutes(23 * 60 + 59, wake, sleep)).toBe(true);
    expect(isUserAwakeAtMinutes(0 * 60 + 30, wake, sleep)).toBe(true);
    expect(isUserAwakeAtMinutes(2 * 60, wake, sleep)).toBe(false);
    expect(isUserAwakeAtMinutes(8 * 60, wake, sleep)).toBe(true);
  });
});

describe("isUserAwake", () => {
  it("detects sleep at 23:59 for wake 07:00 sleep 23:00", () => {
    const utc = new Date("2026-06-18T20:59:00.000Z");
    expect(isUserAwake(utc, "Europe/Moscow", "07:00", "23:00")).toBe(false);
  });

  it("detects awake at 22:30 before sleep 23:00", () => {
    const utc = new Date("2026-06-18T19:30:00.000Z");
    expect(isUserAwake(utc, "Europe/Moscow", "07:00", "23:00")).toBe(true);
  });
});

describe("isWakeFlushMinute", () => {
  it("matches wake time and early-rise target", () => {
    const utc = new Date("2026-06-18T04:00:00.000Z");
    expect(isWakeFlushMinute(utc, "Europe/Moscow", "07:00", "06:55")).toBe(true);
    expect(isWakeFlushMinute(utc, "Europe/Moscow", "07:00", null)).toBe(true);
    expect(isWakeFlushMinute(utc, "Europe/Moscow", "08:00", null)).toBe(false);
  });
});
