import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COACH_DAILY_MESSAGE_LIMIT } from "@mytodo/shared";
import { demoEnterShowcase, demoSendCoachChat } from "./demo-api";

const DEMO_STORAGE_KEY = "mytodo_demo_state";
const storage = new Map<string, string>();

describe("demoSendCoachChat", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      key: () => null,
      length: 0,
    });
    demoEnterShowcase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a template reply for a dark smoking habit", () => {
    const raw = storage.get(DEMO_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw!) as { habits: Array<{ id: string; template_id: string; side: string }> };
    const smoking = state.habits.find((habit) => habit.template_id === "smoking" && habit.side === "dark");
    expect(smoking).toBeTruthy();

    const response = demoSendCoachChat({
      habit_id: smoking!.id,
      message: "привет",
    });

    expect(response.reply).toContain("Привет");
    expect(response.reply).not.toContain("10 глубоких вдохов");
    expect(response.messages_left).toBe(COACH_DAILY_MESSAGE_LIMIT - 1);
    expect(response.source).toBe("template");
  });
});
