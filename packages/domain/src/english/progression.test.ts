import { describe, expect, it } from "vitest";
import { computeNextEnglishDay } from "./progression.js";

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
