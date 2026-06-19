import { describe, expect, it } from "vitest";
import { computeDailyBudgetMin } from "./constants.js";

describe("computeDailyBudgetMin", () => {
  it("caps budget at 60 minutes", () => {
    expect(computeDailyBudgetMin(90)).toBe(60);
    expect(computeDailyBudgetMin(60)).toBe(60);
  });

  it("uses free time when below cap", () => {
    expect(computeDailyBudgetMin(45)).toBe(45);
    expect(computeDailyBudgetMin(30)).toBe(30);
  });
});
