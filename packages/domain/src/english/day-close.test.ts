import { describe, expect, it } from "vitest";
import { closeEnglishDay, resolveEnglishDayStatus } from "./day-close.js";

describe("resolveEnglishDayStatus", () => {
  it("maps pending and unknown statuses to fail", () => {
    expect(resolveEnglishDayStatus(undefined)).toBe("fail");
    expect(resolveEnglishDayStatus("pending")).toBe("fail");
    expect(resolveEnglishDayStatus("unknown")).toBe("fail");
  });
});

describe("closeEnglishDay", () => {
  it("marks missing progress as fail and keeps current_day", () => {
    expect(closeEnglishDay(4)).toEqual({ status: "fail", nextDay: 4 });
  });

  it("treats pending progress as fail at day close", () => {
    expect(closeEnglishDay(3, { status: "pending" })).toEqual({ status: "fail", nextDay: 3 });
  });

  it("advances current_day only after success", () => {
    expect(closeEnglishDay(2, { status: "success" })).toEqual({
      status: "success",
      nextDay: 3,
    });
  });

  it("does not advance after skip or fail", () => {
    expect(closeEnglishDay(7, { status: "skipped" })).toEqual({
      status: "skipped",
      nextDay: 7,
    });
    expect(closeEnglishDay(7, { status: "fail" })).toEqual({
      status: "fail",
      nextDay: 7,
    });
  });
});
