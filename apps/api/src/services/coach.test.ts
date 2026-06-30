import { describe, expect, it, vi } from "vitest";
import { COACH_DAILY_MESSAGE_LIMIT } from "@mytodo/shared";
import { CoachService } from "./coach.js";

function createHabit() {
  return {
    id: "habit-1",
    userId: "user-1",
    name: "Курение",
    side: "dark",
    templateId: "smoking",
    type: "limit",
    unit: "cigarettes",
    currentGoal: "10",
    successDaysAtGoal: 2,
    progressionIntervalDays: 3,
    lastRelapseAt: null,
    isActive: true,
  };
}

function createUser() {
  return {
    id: "user-1",
    timezone: "Europe/Moscow",
    harshnessLevel: 2,
    silenceModeUntil: null,
  };
}

describe("CoachService", () => {
  it("returns template greeting when GigaChat is not configured", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createHabit()]),
          }),
        }),
      }),
    };

    const service = new CoachService(db as never, null, null);
    const result = await service.chat(createUser() as never, {
      habit_id: "habit-1",
      message: "привет",
    });

    expect(result.reply).toContain("Привет");
    expect(result.source).toBe("template");
    expect(result.messages_left).toBe(COACH_DAILY_MESSAGE_LIMIT - 1);
  });

  it("uses GigaChat when client is configured", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createHabit()]),
          }),
        }),
      }),
    };

    const gigaChat = {
      complete: vi.fn().mockResolvedValue("Живой ответ от модели"),
    };

    const service = new CoachService(db as never, null, gigaChat);
    const result = await service.chat(createUser() as never, {
      habit_id: "habit-1",
      message: "привет",
    });

    expect(result.reply).toBe("Живой ответ от модели");
    expect(result.source).toBe("gigachat");
    expect(gigaChat.complete).toHaveBeenCalledOnce();
  });
});
