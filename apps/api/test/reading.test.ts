import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authResponseSchema,
  checkinResponseSchema,
  habitReadingProgressSchema,
  habitResponseSchema,
  todayLightResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Reading progress", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];
  let db: Awaited<ReturnType<typeof buildApp>>["app"]["db"];

  beforeAll(async () => {
    await ensureMigrated(env);
    const built = await buildApp({ env });
    app = built.app;
    db = built.app.db;
    await app.ready();
  });

  beforeEach(async () => {
    await truncateAuthTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createOnboardedUser(email = "reading@example.com") {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Reader",
        age: 30,
        gender: "male",
      },
    });

    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        weight_kg: 75,
        height_cm: 180,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
      },
    });

    return auth;
  }

  async function createBooksHabit(token: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: "books",
        baseline_value: 5,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  it("selects a book and returns reading progress", async () => {
    const auth = await createOnboardedUser();
    const habit = await createBooksHabit(auth.access_token);

    const selectResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habit.id}/reading/select`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        book_id: "meditations",
      },
    });

    expect(selectResponse.statusCode).toBe(200);
    const reading = habitReadingProgressSchema.parse(JSON.parse(selectResponse.body));
    expect(reading.book_id).toBe("meditations");
    expect(reading.pages_read).toBe(0);
    expect(reading.last_read_page).toBe(1);
    expect(reading.page_count).toBe(176);
    expect(reading.last_checkin_date).toBeNull();

    const changeResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habit.id}/reading/select`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        book_id: "self-help-smiles",
        checkin_baseline: 0,
      },
    });

    expect(changeResponse.statusCode).toBe(200);
    const changed = habitReadingProgressSchema.parse(JSON.parse(changeResponse.body));
    expect(changed.book_id).toBe("self-help-smiles");
    expect(changed.pages_read).toBe(0);
    expect(changed.last_read_page).toBe(1);
    expect(changed.last_checkin_date).not.toBeNull();

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habit.id}/reading`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(getResponse.statusCode).toBe(200);
    const body = JSON.parse(getResponse.body) as { reading: unknown };
    expect(habitReadingProgressSchema.parse(body.reading).book_id).toBe("self-help-smiles");
  });

  it("credits pages_read when checkin value increases", async () => {
    const auth = await createOnboardedUser("reading-credit@example.com");
    const habit = await createBooksHabit(auth.access_token);

    await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habit.id}/reading/select`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { book_id: "meditations" },
    });

    const checkinResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        date: "2026-06-24",
        value: 7,
      },
    });

    expect(checkinResponse.statusCode).toBe(201);
    checkinResponseSchema.parse(JSON.parse(checkinResponse.body));

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habit.id}/reading`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = JSON.parse(getResponse.body) as { reading: unknown };
    const reading = habitReadingProgressSchema.parse(body.reading);
    expect(reading.pages_read).toBe(7);
    expect(reading.pages_credited_today).toBe(7);
    expect(reading.last_checkin_date).toBe("2026-06-24");
  });

  it("includes reading on today light payload for books habits", async () => {
    const auth = await createOnboardedUser("reading-today@example.com");
    const habit = await createBooksHabit(auth.access_token);

    await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habit.id}/reading/select`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { book_id: "meditations" },
    });

    const todayResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(todayResponse.statusCode).toBe(200);
    const today = todayLightResponseSchema.parse(JSON.parse(todayResponse.body));
    const booksHabit = today.habits.find((item) => item.id === habit.id);
    expect(booksHabit?.reading?.book_id).toBe("meditations");
  });

  it("updates last_read_page bookmark", async () => {
    const auth = await createOnboardedUser("reading-bookmark@example.com");
    const habit = await createBooksHabit(auth.access_token);

    await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habit.id}/reading/select`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { book_id: "meditations" },
    });

    const bookmarkResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/habits/${habit.id}/reading/bookmark`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { last_read_page: 42 },
    });

    expect(bookmarkResponse.statusCode).toBe(200);
    const bookmark = habitReadingProgressSchema.parse(JSON.parse(bookmarkResponse.body));
    expect(bookmark.last_read_page).toBe(42);

    const clampedResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/habits/${habit.id}/reading/bookmark`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { last_read_page: 9999 },
    });

    const clamped = habitReadingProgressSchema.parse(JSON.parse(clampedResponse.body));
    expect(clamped.last_read_page).toBe(176);
  });

  it("persists reading timer across sessions on the same day", async () => {
    const auth = await createOnboardedUser("reading-timer@example.com");
    const habit = await createBooksHabit(auth.access_token);

    await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habit.id}/reading/select`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { book_id: "meditations" },
    });

    const saveTimerResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/habits/${habit.id}/reading/bookmark`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        timer_remaining_seconds: 345,
        timer_saved_date: "2026-06-24",
      },
    });

    expect(saveTimerResponse.statusCode).toBe(200);
    const saved = habitReadingProgressSchema.parse(JSON.parse(saveTimerResponse.body));
    expect(saved.timer_remaining_seconds).toBe(345);
    expect(saved.timer_saved_date).toBe("2026-06-24");

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habit.id}/reading`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = JSON.parse(getResponse.body) as { reading: unknown };
    const reading = habitReadingProgressSchema.parse(body.reading);
    expect(reading.timer_remaining_seconds).toBe(345);
  });
});
