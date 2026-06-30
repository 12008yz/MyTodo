import { describe, expect, it } from "vitest";
import { darkReductionDots, formatDarkReductionProgressLabel } from "./dark-progress.js";

describe("darkReductionDots", () => {
  it("shows progress toward interval of 3", () => {
    expect(darkReductionDots(0, 3, false)).toEqual(["current", "pending", "pending"]);
    expect(darkReductionDots(0, 3, true)).toEqual(["done", "current", "pending"]);
    expect(darkReductionDots(1, 3, false)).toEqual(["done", "current", "pending"]);
    expect(darkReductionDots(2, 3, true)).toEqual(["done", "done", "done"]);
  });
});

describe("formatDarkReductionProgressLabel", () => {
  it("formats remaining days", () => {
    expect(formatDarkReductionProgressLabel(1, 3, false)).toBe("1 из 3 дней до снижения");
    expect(formatDarkReductionProgressLabel(2, 3, true)).toBe("Завтра лимит снизится");
  });
});
