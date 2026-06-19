import { describe, expect, it } from "vitest";
import { getUserLocalDate, isDayCloseMinute } from "./user-day.js";

describe("getUserLocalDate", () => {
  it("returns local calendar date in user timezone", () => {
    const utc = new Date("2026-06-18T22:00:00Z");
    expect(getUserLocalDate(utc, "Europe/Moscow")).toBe("2026-06-19");
    expect(getUserLocalDate(utc, "UTC")).toBe("2026-06-18");
  });
});

describe("isDayCloseMinute", () => {
  it("detects 23:59 in Europe/Moscow", () => {
    const utc = new Date("2026-06-18T20:59:00Z");
    expect(isDayCloseMinute(utc, "Europe/Moscow")).toBe(true);
    expect(isDayCloseMinute(new Date("2026-06-18T20:58:00Z"), "Europe/Moscow")).toBe(false);
  });

  it("detects 23:59 in Asia/Vladivostok", () => {
    const utc = new Date("2026-06-18T13:59:00Z");
    expect(isDayCloseMinute(utc, "Asia/Vladivostok")).toBe(true);
    expect(isDayCloseMinute(new Date("2026-06-18T13:58:00Z"), "Asia/Vladivostok")).toBe(false);
  });
});
