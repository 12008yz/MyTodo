import { describe, expect, it } from "vitest";
import { computeEnglishPreviewNextDay, computeNextEnglishDay } from "./progression.js";

describe("computeNextEnglishDay", () => {
  it("advances only after a successful day", () => {
    expect(computeNextEnglishDay(1, "success")).toBe(2);
    expect(computeNextEnglishDay(5, "success")).toBe(6);
  });

  it("keeps the same day after fail or skip", () => {
    expect(computeNextEnglishDay(3, "fail")).toBe(3);
    expect(computeNextEnglishDay(3, "skipped")).toBe(3);
  });
});

describe("computeEnglishPreviewNextDay", () => {
  it("uses the scheduled day when the active lesson matches current_day", () => {
    expect(computeEnglishPreviewNextDay(5, 5, null)).toBe(5);
    expect(computeEnglishPreviewNextDay(5, 5, "success")).toBe(6);
    expect(computeEnglishPreviewNextDay(5, 5, "skipped")).toBe(5);
  });

  it("uses the selected lesson day when it differs from current_day", () => {
    expect(computeEnglishPreviewNextDay(1, 60, null)).toBe(60);
    expect(computeEnglishPreviewNextDay(1, 60, "success")).toBe(61);
    expect(computeEnglishPreviewNextDay(1, 60, "fail")).toBe(60);
  });
});
