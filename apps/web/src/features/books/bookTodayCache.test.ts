import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { TodayLightResponse } from "@mytodo/shared";
import { patchBooksHabitOnToday } from "./bookTodayCache";

const baseToday: TodayLightResponse = {
  date: "2026-06-28",
  greeting_name: "Reader",
  daily_budget_min: 60,
  minutes_logged_today: 0,
  stats: {
    completed_today: 0,
    relapses_this_week: 0,
    minutes_today: 0,
    pomodoros_today: 0,
    streak_days: 0,
  },
  habits: [
    {
      id: "habit-1",
      name: "Чтение",
      template_id: "books",
      type: "target",
      side: "light",
      unit: "pages",
      current_goal: 5,
      baseline_value: 5,
      growth_step: 2,
      progression_interval_days: 2,
      success_days_at_goal: 0,
      preview_next_goal: 5,
      streak_days: 0,
      category_key: "meditation",
      icon: null,
      is_active: true,
      allows_weekly_skip: true,
      checkin: {
        id: "checkin-1",
        date: "2026-06-28",
        status: "pending",
        value: 17,
        updated_at: "2026-06-28T10:00:00.000Z",
        current_goal: 5,
        preview_next_goal: 5,
      },
      reading: {
        book_id: "meditations",
        pages_read: 20,
        pages_credited_today: 17,
        last_read_page: 17,
        reader_day_start_page: 11,
        reader_day_date: "2026-06-28",
        last_checkin_date: "2026-06-28",
        completed_at: null,
        page_count: 176,
      },
    },
  ],
  daily_plan: {
    blocks: [],
    minutes_planned: 0,
    minutes_completed: 0,
    minutes_remaining: 0,
  },
};

describe("patchBooksHabitOnToday", () => {
  it("updates checkin and bookmark optimistically", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["today", "light"], baseToday);

    patchBooksHabitOnToday(queryClient, "habit-1", {
      checkinValue: 27,
      lastReadPage: 37,
    });

    const next = queryClient.getQueryData<TodayLightResponse>(["today", "light"]);
    const habit = next?.habits[0];

    expect(habit?.checkin?.value).toBe(27);
    expect(habit?.checkin?.status).toBe("success");
    expect(habit?.reading?.last_read_page).toBe(37);
    expect(habit?.reading?.pages_credited_today).toBe(27);
    expect(habit?.reading?.last_checkin_date).toBe("2026-06-28");
  });

  it("updates reader day baseline fields", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["today", "light"], baseToday);

    patchBooksHabitOnToday(queryClient, "habit-1", {
      readerDayStartPage: 11,
      readerDayDate: "2026-06-28",
    });

    const habit = queryClient.getQueryData<TodayLightResponse>(["today", "light"])?.habits[0];
    expect(habit?.reading?.reader_day_start_page).toBe(11);
    expect(habit?.reading?.reader_day_date).toBe("2026-06-28");
  });
});
