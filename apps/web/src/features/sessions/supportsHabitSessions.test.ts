import { describe, expect, it } from "vitest";
import { supportsHabitSessions } from "./supportsHabitSessions";

describe("supportsHabitSessions", () => {
  it("rejects abstinence and social media dark habits", () => {
    expect(
      supportsHabitSessions({
        side: "dark",
        type: "abstinence",
        template_id: "nail_biting",
      }),
    ).toBe(false);

    expect(
      supportsHabitSessions({
        side: "dark",
        type: "limit",
        template_id: "social_media",
      }),
    ).toBe(false);
  });

  it("allows light habits and dark limit habits except social media", () => {
    expect(
      supportsHabitSessions({
        side: "light",
        type: "target",
        template_id: "running",
      }),
    ).toBe(true);

    expect(
      supportsHabitSessions({
        side: "dark",
        type: "limit",
        template_id: "smoking",
      }),
    ).toBe(true);
  });
});
