import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  demoClearHabitBook,
  demoCreateCheckin,
  demoEnterShowcase,
  demoGetTodayLight,
  demoSelectHabitBook,
  demoUpdateReadingBookmark,
} from "./demo-api";

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

function findBooksHabit() {
  const today = demoGetTodayLight();
  const habit = today.habits.find((row) => row.template_id === "books");
  if (!habit) {
    throw new Error("books habit not found in showcase");
  }
  return habit;
}

describe("demo books habit", () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks daily goal success when enough pages are read", () => {
    const habit = findBooksHabit();
    demoSelectHabitBook(habit.id, { book_id: "meditations" });

    const checkin = demoCreateCheckin({
      habit_id: habit.id,
      value: habit.current_goal,
    });

    expect(checkin.status).toBe("success");
    expect(checkin.value).toBe(habit.current_goal);

    const today = demoGetTodayLight();
    const booksHabit = today.habits.find((row) => row.id === habit.id);
    expect(booksHabit?.checkin?.status).toBe("success");
    expect(booksHabit?.reading?.pages_credited_today).toBe(habit.current_goal);
  });

  it("resets today checkin when switching to another book", () => {
    const habit = findBooksHabit();
    demoSelectHabitBook(habit.id, { book_id: "meditations" });
    demoCreateCheckin({
      habit_id: habit.id,
      value: habit.current_goal,
    });

    demoSelectHabitBook(habit.id, {
      book_id: "self-help-smiles",
      checkin_baseline: 0,
    });

    const state = readDemoState();
    const date = todayDate();
    const todayCheckin = state.checkins.find(
      (row: { habit_id: string; date: string }) =>
        row.habit_id === habit.id && row.date === date,
    );
    expect(todayCheckin).toBeUndefined();

    const today = demoGetTodayLight();
    const booksHabit = today.habits.find((row) => row.id === habit.id);
    expect(booksHabit?.checkin).toBeNull();
    expect(booksHabit?.reading?.book_id).toBe("self-help-smiles");
    expect(booksHabit?.reading?.completed_at).toBeNull();
    expect(booksHabit?.reading?.pages_credited_today).toBe(0);
  });

  it("sets completed_at when bookmark reaches the last page", () => {
    const habit = findBooksHabit();
    demoSelectHabitBook(habit.id, { book_id: "meditations" });

    const reading = demoUpdateReadingBookmark(habit.id, { last_read_page: 176 });
    expect(reading.completed_at).not.toBeNull();
    expect(reading.last_read_page).toBe(176);
  });

  it("clears today checkin when book selection is cleared", () => {
    const habit = findBooksHabit();
    demoSelectHabitBook(habit.id, { book_id: "meditations" });
    demoCreateCheckin({
      habit_id: habit.id,
      value: habit.current_goal,
    });

    demoClearHabitBook(habit.id);

    const today = demoGetTodayLight();
    const booksHabit = today.habits.find((row) => row.id === habit.id);
    expect(booksHabit?.checkin).toBeNull();
    expect(booksHabit?.reading).toBeNull();
  });
});
