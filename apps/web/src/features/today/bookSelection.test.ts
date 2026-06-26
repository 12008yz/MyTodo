import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeEffectivePagesRead,
  persistBookCheckinProgress,
  writeSelectedBook,
} from "./bookSelection";

const HABIT_ID = "habit-books-1";

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  });
}

describe("bookSelection progress", () => {
  beforeEach(() => {
    installLocalStorageMock();
    writeSelectedBook(HABIT_ID, {
      id: "meditations",
      title: "Размышления",
      author: "Марк Аврелий",
    });
  });

  it("tracks pages from checkins across days", () => {
    persistBookCheckinProgress(HABIT_ID, "2026-06-24", 5);
    expect(computeEffectivePagesRead(HABIT_ID, "2026-06-24", 5, 0)).toBe(5);

    expect(computeEffectivePagesRead(HABIT_ID, "2026-06-25", 0, 0)).toBe(5);
    persistBookCheckinProgress(HABIT_ID, "2026-06-25", 3);
    expect(computeEffectivePagesRead(HABIT_ID, "2026-06-25", 3, 0)).toBe(8);
  });

  it("includes live session pages before checkin is saved", () => {
    persistBookCheckinProgress(HABIT_ID, "2026-06-24", 5);
    persistBookCheckinProgress(HABIT_ID, "2026-06-25", 3);
    expect(computeEffectivePagesRead(HABIT_ID, "2026-06-25", 3, 2)).toBe(10);
  });

  it("resets progress when book changes", () => {
    persistBookCheckinProgress(HABIT_ID, "2026-06-25", 10);
    writeSelectedBook(
      HABIT_ID,
      {
        id: "chto-delat",
        title: "Что делать?",
        author: "Николай Чернышевский",
      },
      { planDate: "2026-06-25", checkinBaseline: 0 },
    );
    expect(computeEffectivePagesRead(HABIT_ID, "2026-06-25", 0, 0)).toBe(0);
    expect(computeEffectivePagesRead(HABIT_ID, "2026-06-25", 2, 0)).toBe(2);
  });
});
