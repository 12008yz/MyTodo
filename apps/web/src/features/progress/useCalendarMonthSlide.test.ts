import { describe, expect, it } from "vitest";
import { calendarSlideClass } from "./useCalendarMonthSlide";

describe("calendarSlideClass", () => {
  it("adds direction modifier when sliding", () => {
    expect(calendarSlideClass("progress__calendar-grid", "right")).toBe(
      "progress__calendar-grid progress__calendar-grid--from-right",
    );
    expect(calendarSlideClass("progress__calendar-grid", "left")).toBe(
      "progress__calendar-grid progress__calendar-grid--from-left",
    );
  });

  it("returns base class without animation on first paint", () => {
    expect(calendarSlideClass("progress__calendar-grid", "none")).toBe(
      "progress__calendar-grid",
    );
  });
});
