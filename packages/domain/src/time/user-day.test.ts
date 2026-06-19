import { describe, expect, it } from "vitest";
import { getUserLocalDate } from "./user-day.js";

describe("getUserLocalDate", () => {
  it("returns local calendar date in user timezone", () => {
    const utc = new Date("2026-06-18T22:00:00Z");
    expect(getUserLocalDate(utc, "Europe/Moscow")).toBe("2026-06-19");
    expect(getUserLocalDate(utc, "UTC")).toBe("2026-06-18");
  });
});
