import { describe, expect, it } from "vitest";
import { batchCheckinRequestSchema } from "./checkins.js";

describe("batchCheckinRequestSchema", () => {
  const habitId = "11111111-1111-1111-1111-111111111111";

  it("rejects duplicate explicit dates in batch", () => {
    const result = batchCheckinRequestSchema.safeParse({
      checkins: [
        { habit_id: habitId, date: "2026-06-18", value: 10 },
        { habit_id: habitId, date: "2026-06-18", value: 20 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("allows same habit on different dates", () => {
    const result = batchCheckinRequestSchema.safeParse({
      checkins: [
        { habit_id: habitId, date: "2026-06-18", value: 10 },
        { habit_id: habitId, date: "2026-06-19", value: 20 },
      ],
    });

    expect(result.success).toBe(true);
  });
});
