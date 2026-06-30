import { describe, expect, it } from "vitest";
import { listMonthsInRange } from "./listMonthsInRange";

describe("listMonthsInRange", () => {
  it("returns a single month when range is inside one month", () => {
    expect(listMonthsInRange("2026-06-01", "2026-06-30")).toEqual(["2026-06"]);
  });

  it("spans months across a year boundary", () => {
    expect(listMonthsInRange("2025-11-15", "2026-02-03")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
