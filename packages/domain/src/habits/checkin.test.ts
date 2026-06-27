import { describe, expect, it } from "vitest";
import {
  canSkipThisWeek,
  countSkipsInWeek,
  resolveCheckinStatus,
  type HabitForCheckin,
} from "./checkin.js";

const lightTarget = (currentGoal: number): HabitForCheckin => ({
  type: "target",
  side: "light",
  currentGoal,
});

const darkLimit = (currentGoal: number): HabitForCheckin => ({
  type: "limit",
  side: "dark",
  currentGoal,
});

const abstinence: HabitForCheckin = {
  type: "abstinence",
  side: "dark",
  currentGoal: 0,
};

const booksHabit = (currentGoal: number): HabitForCheckin => ({
  type: "target",
  side: "light",
  currentGoal,
  templateId: "books",
});

describe("resolveCheckinStatus", () => {
  it("keeps light target in progress until the daily goal is met or the day closes", () => {
    expect(resolveCheckinStatus(lightTarget(10), { value: 9 })).toBe("pending");
    expect(resolveCheckinStatus(lightTarget(10), { value: 0 })).toBe("pending");
    expect(resolveCheckinStatus(booksHabit(5), { value: 3 })).toBe("pending");
    expect(resolveCheckinStatus(booksHabit(5), { value: 0 })).toBe("pending");
  });

  it("marks light target success when the daily goal is reached", () => {
    expect(resolveCheckinStatus(lightTarget(10), { value: 10 })).toBe("success");
    expect(resolveCheckinStatus(lightTarget(10), { value: 12 })).toBe("success");
    expect(resolveCheckinStatus(booksHabit(5), { value: 5 })).toBe("success");
    expect(resolveCheckinStatus(booksHabit(5), { value: 8 })).toBe("success");
  });

  it("marks dark limit success when value is within goal", () => {
    expect(resolveCheckinStatus(darkLimit(20), { value: 18 })).toBe("success");
    expect(resolveCheckinStatus(darkLimit(20), { value: 20 })).toBe("success");
  });

  it("marks dark limit fail when value exceeds goal", () => {
    expect(resolveCheckinStatus(darkLimit(20), { value: 21 })).toBe("fail");
  });

  it("returns skipped when explicitly requested for light habits", () => {
    expect(resolveCheckinStatus(lightTarget(10), { status: "skipped" })).toBe("skipped");
  });

  it("returns fail for abstinence relapse", () => {
    expect(resolveCheckinStatus(abstinence, { status: "fail" })).toBe("fail");
  });
});

describe("canSkipThisWeek", () => {
  it("counts skips within Monday-Sunday week", () => {
    expect(countSkipsInWeek(["2026-06-15", "2026-06-17"], "2026-06-18")).toBe(2);
    expect(countSkipsInWeek(["2026-06-15"], "2026-06-18")).toBe(1);
    expect(countSkipsInWeek(["2026-06-08"], "2026-06-18")).toBe(0);
  });

  it("allows skip when fewer than two skips in the week", () => {
    expect(canSkipThisWeek([], "2026-06-18")).toBe(true);
    expect(canSkipThisWeek(["2026-06-15"], "2026-06-18")).toBe(true);
    expect(canSkipThisWeek(["2026-06-15", "2026-06-16"], "2026-06-18")).toBe(false);
  });
});
