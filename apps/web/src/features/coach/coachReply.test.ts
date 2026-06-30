import { describe, expect, it } from "vitest";
import { buildLocalCoachReply } from "./coachReply";

describe("buildLocalCoachReply", () => {
  it("returns habit-specific urge message", () => {
    const reply = buildLocalCoachReply("smoking", 1, "Тянет сорваться");
    expect(reply).toContain("Срыв");
  });

  it("returns greeting for hello", () => {
    const reply = buildLocalCoachReply("smoking", 2, "привет");
    expect(reply).toContain("Привет");
    expect(reply).not.toContain("10 глубоких вдохов");
  });

  it("returns relief message when user feels better", () => {
    const reply = buildLocalCoachReply("sugar", 2, "Мне легче");
    expect(reply).toContain("справился");
  });
});
