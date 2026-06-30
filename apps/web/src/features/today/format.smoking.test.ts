import { describe, expect, it } from "vitest";
import { formatSmokingRemainingLabel } from "./format";

describe("formatSmokingRemainingLabel", () => {
  it("shows remaining cigarettes with correct plural forms", () => {
    expect(formatSmokingRemainingLabel(0, 25)).toBe("осталось 25 сигарет");
    expect(formatSmokingRemainingLabel(1, 25)).toBe("осталось 24 сигареты");
    expect(formatSmokingRemainingLabel(4, 12)).toBe("осталось 8 сигарет");
    expect(formatSmokingRemainingLabel(11, 12)).toBe("осталось 1 сигарета");
  });

  it("marks the daily allowance as exhausted at or above the limit", () => {
    expect(formatSmokingRemainingLabel(12, 12)).toBe("лимит на сегодня исчерпан");
    expect(formatSmokingRemainingLabel(14, 12)).toBe("лимит на сегодня исчерпан");
  });
});
