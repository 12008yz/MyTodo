import { describe, expect, it } from "vitest";
import {
  computeCheerSlotTimes,
  computeDailyPushSchedule,
  findDueCheerSlot,
  findDueScheduleEvents,
  isEarlyRiseWakeDue,
  pickCheerCount,
} from "./schedule.js";

describe("push schedule", () => {
  it("computes morning, afternoon, and evening for long days", () => {
    const schedule = computeDailyPushSchedule("07:00", "23:00");
    expect(schedule.map((slot) => slot.eventType)).toEqual(["morning", "afternoon", "evening"]);
    expect(schedule[0]?.at).toEqual({ hour: 7, minute: 0 });
    expect(schedule[1]?.at).toEqual({ hour: 15, minute: 0 });
    expect(schedule[2]?.at).toEqual({ hour: 22, minute: 30 });
  });

  it("skips afternoon when wake-sleep span is under 6 hours", () => {
    const schedule = computeDailyPushSchedule("07:00", "12:00");
    expect(schedule.map((slot) => slot.eventType)).toEqual(["morning", "evening"]);
  });

  it("picks 2 to 3 cheer slots per day", () => {
    expect(pickCheerCount("2026-06-01")).toBeGreaterThanOrEqual(2);
    expect(pickCheerCount("2026-06-01")).toBeLessThanOrEqual(3);
  });

  it("spaces cheer slots at least 2 hours apart", () => {
    const slots = computeCheerSlotTimes("07:00", "23:00", 5);
    expect(slots).toHaveLength(5);
    for (let index = 1; index < slots.length; index += 1) {
      const prev = slots[index - 1]!;
      const current = slots[index]!;
      const gap = current.hour * 60 + current.minute - (prev.hour * 60 + prev.minute);
      expect(gap).toBeGreaterThanOrEqual(120);
    }
  });

  it("detects due schedule events in user timezone", () => {
    const utc = new Date("2026-06-18T04:00:00.000Z");
    const due = findDueScheduleEvents(utc, "Europe/Moscow", "07:00", "23:00");
    expect(due).toEqual(["morning"]);
  });

  it("detects due cheer slot", () => {
    const localDate = "2026-06-18";
    const count = pickCheerCount(localDate);
    const slots = computeCheerSlotTimes("07:00", "23:00", count);
    const first = slots[0]!;
    const utc = new Date(`2026-06-18T${String(first.hour).padStart(2, "0")}:${String(first.minute).padStart(2, "0")}:00.000Z`);
    const slot = findDueCheerSlot(utc, "UTC", "07:00", "23:00", localDate);
    expect(slot).toBe(1);
  });

  it("detects early rise wake time", () => {
    const utc = new Date("2026-06-18T04:00:00.000Z");
    expect(isEarlyRiseWakeDue(utc, "Europe/Moscow", "07:00", 0)).toBe(true);
    expect(isEarlyRiseWakeDue(utc, "Europe/Moscow", "07:00", 5)).toBe(false);
  });
});
