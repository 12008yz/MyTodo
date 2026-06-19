import { describe, expect, it } from "vitest";
import {
  addDays,
  computeDayColor,
  getMonthRange,
  getProgressPeriodRange,
  listDatesInclusive,
} from "./day-color.js";

describe("computeDayColor", () => {
  it("returns pending for an empty habit list", () => {
    expect(computeDayColor([])).toBe("pending");
  });

  it("returns fail when any habit failed", () => {
    expect(computeDayColor(["success", "fail", "skipped"])).toBe("fail");
  });

  it("returns pending when any habit is still open", () => {
    expect(computeDayColor(["success", "pending"])).toBe("pending");
  });

  it("returns success when every habit succeeded", () => {
    expect(computeDayColor(["success", "success"])).toBe("success");
  });

  it("returns skipped for skip-only days without failures", () => {
    expect(computeDayColor(["skipped", "skipped"])).toBe("skipped");
    expect(computeDayColor(["success", "skipped"])).toBe("skipped");
  });
});

describe("date helpers", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("lists dates inclusively", () => {
    expect(listDatesInclusive("2026-06-01", "2026-06-03")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
  });

  it("returns month boundaries", () => {
    expect(getMonthRange("2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("returns progress ranges ending today", () => {
    expect(getProgressPeriodRange("2026-06-19", "week")).toEqual({
      start: "2026-06-13",
      end: "2026-06-19",
    });
    expect(getProgressPeriodRange("2026-06-19", "quarter").start).toBe("2026-03-22");
  });
});
