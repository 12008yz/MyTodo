import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isForeignLanguageHabit } from "@mytodo/shared";
import {
  demoCompleteEnglishLesson,
  demoEnterShowcase,
  demoGetTodayLight,
  demoResetTodayCheckin,
  demoSelectEnglishLesson,
  demoUpdateEnglishSettings,
} from "./demo-api";
import { englishLessonSeedId } from "@mytodo/shared";

const DEMO_STORAGE_KEY = "mytodo_demo_state";
const storage = new Map<string, string>();

function readDemoState() {
  const raw = storage.get(DEMO_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function todayDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function findTodayCheckin(state: { checkins: Array<{ habit_id: string; date: string }> }, habitId: string) {
  const date = todayDate();
  return state.checkins.find((row) => row.habit_id === habitId && row.date === date);
}

describe("demo foreign language habit", () => {
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
    });
    demoEnterShowcase();
    demoUpdateEnglishSettings({ is_enabled: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks checkin success on video complete without inflating timer minutes", () => {
    const habit = readDemoState().habits.find((row: { category_key: string; name: string }) =>
      isForeignLanguageHabit(row),
    );
    demoResetTodayCheckin(habit.id);

    demoCompleteEnglishLesson({ watched_sec: 600 });


    const state = readDemoState();
    const checkin = findTodayCheckin(state, habit.id);

    expect(checkin?.status).toBe("success");
    expect(checkin?.value ?? 0).toBe(0);
  });

  it("resets today completion when switching to another lesson", () => {
    const habit = readDemoState().habits.find((row: { category_key: string; name: string }) =>
      isForeignLanguageHabit(row),
    );
    demoResetTodayCheckin(habit.id);

    demoCompleteEnglishLesson({ watched_sec: 600 });

    const lesson2Id = englishLessonSeedId(2);
    const minutesBeforeSwitch = demoGetTodayLight().stats.minutes_today;
    demoSelectEnglishLesson({ lesson_id: lesson2Id });

    const todayPayload = demoGetTodayLight();
    const habitRow = todayPayload.habits.find((row) => isForeignLanguageHabit(row));
    const checkin = habitRow?.checkin;

    expect(checkin?.status).not.toBe("success");
    expect(todayPayload.stats.minutes_today).toBe(minutesBeforeSwitch);
  });

  it("keeps stats minutes after switching lesson", () => {
    const habit = readDemoState().habits.find((row: { category_key: string; name: string }) =>
      isForeignLanguageHabit(row),
    );
    demoResetTodayCheckin(habit.id);
    demoCompleteEnglishLesson({ watched_sec: 23 * 60 });

    const minutesBeforeSwitch = demoGetTodayLight().stats.minutes_today;
    demoSelectEnglishLesson({ lesson_id: englishLessonSeedId(2) });

    expect(demoGetTodayLight().stats.minutes_today).toBe(minutesBeforeSwitch);
  });
});
