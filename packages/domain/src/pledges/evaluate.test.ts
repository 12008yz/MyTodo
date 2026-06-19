import { describe, expect, it } from "vitest";
import { evaluatePledgePeriod, type PledgeDayRecord } from "./evaluate.js";

const START = "2026-06-01";

function allSuccess(): PledgeDayRecord[] {
  return Array.from({ length: 30 }, (_, index) => ({
    date: `2026-06-${String(index + 1).padStart(2, "0")}`,
    status: "success" as const,
  }));
}

describe("evaluatePledgePeriod", () => {
  it("succeeds when all 30 days are success", () => {
    expect(evaluatePledgePeriod(allSuccess(), START)).toBe("success");
  });

  it("allows skipped days (silence mode)", () => {
    const records = allSuccess();
    records[5] = { date: "2026-06-06", status: "skipped" };
    expect(evaluatePledgePeriod(records, START)).toBe("success");
  });

  it("fails on any fail day", () => {
    const records = allSuccess();
    records[10] = { date: "2026-06-11", status: "fail" };
    expect(evaluatePledgePeriod(records, START)).toBe("failed");
  });

  it("fails when a day is missing", () => {
    const records = allSuccess().slice(0, 29);
    expect(evaluatePledgePeriod(records, START)).toBe("failed");
  });
});
