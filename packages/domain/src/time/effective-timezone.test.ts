import { describe, expect, it } from "vitest";
import {
  resolveEffectiveTimezone,
  scheduleTimezoneChange,
  shouldApplyPendingTimezone,
} from "./effective-timezone.js";

describe("effective timezone", () => {
  it("keeps current timezone when no pending change", () => {
    expect(
      resolveEffectiveTimezone({ timezone: "Europe/Moscow", pendingTimezone: null, pendingTimezoneFrom: null }, new Date()),
    ).toBe("Europe/Moscow");
  });

  it("defers new timezone until pending date", () => {
    const state = {
      timezone: "Europe/Moscow",
      pendingTimezone: "Asia/Yekaterinburg",
      pendingTimezoneFrom: "2026-06-16",
    };
    const before = new Date("2026-06-15T20:00:00Z");
    expect(resolveEffectiveTimezone(state, before)).toBe("Europe/Moscow");
    const after = new Date("2026-06-16T08:00:00Z");
    expect(resolveEffectiveTimezone(state, after)).toBe("Asia/Yekaterinburg");
  });

  it("schedules timezone from next local day", () => {
    const now = new Date("2026-06-15T10:00:00Z");
    expect(scheduleTimezoneChange("Europe/Moscow", "Asia/Yekaterinburg", now)).toEqual({
      pendingTimezone: "Asia/Yekaterinburg",
      pendingTimezoneFrom: "2026-06-16",
    });
  });

  it("detects when pending timezone should be applied", () => {
    const state = {
      timezone: "Europe/Moscow",
      pendingTimezone: "Asia/Yekaterinburg",
      pendingTimezoneFrom: "2026-06-16",
    };
    expect(shouldApplyPendingTimezone(state, new Date("2026-06-15T20:00:00Z"))).toBe(false);
    expect(shouldApplyPendingTimezone(state, new Date("2026-06-16T08:00:00Z"))).toBe(true);
  });
});
