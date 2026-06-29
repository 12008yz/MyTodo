import { describe, expect, it } from "vitest";
import { resolveEnglishCardMinutes } from "./englishLessonManual";

describe("resolveEnglishCardMinutes", () => {
  it("adds manual minutes on top of video progress", () => {
    expect(resolveEnglishCardMinutes(20, 5, 25)).toBe(25);
    expect(resolveEnglishCardMinutes(10, 5, 25)).toBe(15);
  });

  it("caps the card at the daily goal", () => {
    expect(resolveEnglishCardMinutes(20, 10, 25)).toBe(25);
  });
});
