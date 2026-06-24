import { describe, expect, it } from "vitest";
import { computeDailyBudgetMin } from "./constants.js";

describe("computeDailyBudgetMin", () => {
  it("uses full free time as daily budget", () => {
    expect(computeDailyBudgetMin(90)).toBe(90);
    expect(computeDailyBudgetMin(120)).toBe(120);
  });

  it("uses free time when below cap", () => {
    expect(computeDailyBudgetMin(45)).toBe(45);
    expect(computeDailyBudgetMin(30)).toBe(30);
  });
});
