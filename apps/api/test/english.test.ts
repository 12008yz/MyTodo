import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getUserLocalDate, getWeekStartMonday, listDatesInclusive } from "@mytodo/domain";
import {
  authResponseSchema,
  englishCompleteResponseSchema,
  englishHistoryResponseSchema,
  englishSettingsResponseSchema,
  englishSkipResponseSchema,
  englishTodayResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { englishLessons, englishProgress, englishSettings } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

const TIMEZONE = "Europe/Moscow";

function hasTwoPriorDaysInWeek(): boolean {
  const today = getUserLocalDate(new Date(), TIMEZONE);
  const weekStart = getWeekStartMonday(today);
  return listDatesInclusive(weekStart, today).filter((date) => date < today).length >= 2;
}

const LESSON_FIXTURE = [
  { dayNumber: 1, title: "Day 1: Greetings", videoUrl: "https://example.com/lesson-1", durationSec: 600 },
  { dayNumber: 2, title: "Day 2: Small talk", videoUrl: "https://example.com/lesson-2", durationSec: 480 },
  { dayNumber: 3, title: "Day 3: Travel", videoUrl: "https://example.com/lesson-3", durationSec: 540 },
  { dayNumber: 4, title: "Day 4: Food", videoUrl: "https://example.com/lesson-4", durationSec: 420 },
  { dayNumber: 5, title: "Day 5: Work", videoUrl: "https://example.com/lesson-5", durationSec: 360 },
] as const;

describe("English", () => {
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
    await seedLessons();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedLessons() {
    for (const lesson of LESSON_FIXTURE) {
      await db.insert(englishLessons).values({
        dayNumber: lesson.dayNumber,
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        durationSec: lesson.durationSec,
      });
    }
  }

  async function createOnboardedUser(email: string) {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "English User",
        age: 28,
        gender: "female",
      },
    });

    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      payload: {
        weight_kg: 65,
        height_cm: 170,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
        timezone: TIMEZONE,
      },
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    return auth;
  }

  async function enableEnglish(token: string) {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/english/settings",
      headers: { authorization: `Bearer ${token}` },
      payload: { is_enabled: true },
    });

    return englishSettingsResponseSchema.parse(JSON.parse(response.body));
  }

  it("returns disabled payload before the module is enabled", async () => {
    const auth = await createOnboardedUser("english-disabled@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/english/today",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = englishTodayResponseSchema.parse(JSON.parse(response.body));
    expect(body.enabled).toBe(false);
  });

  it("completes a lesson without changing current_day in the database", async () => {
    const auth = await createOnboardedUser("english-complete@example.com");
    await enableEnglish(auth.access_token);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/english/complete",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { watched_sec: 480 },
    });

    expect(response.statusCode).toBe(200);
    const body = englishCompleteResponseSchema.parse(JSON.parse(response.body));
    expect(body.current_day).toBe(1);
    expect(body.preview_next_day).toBe(2);

    const [settings] = await db.select().from(englishSettings);
    expect(settings?.currentDay).toBe(1);
  });

  it("returns preview_next_day on today after completion", async () => {
    const auth = await createOnboardedUser("english-today@example.com");
    await enableEnglish(auth.access_token);

    await app.inject({
      method: "POST",
      url: "/api/v1/english/complete",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { watched_sec: 480 },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/english/today",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = englishTodayResponseSchema.parse(JSON.parse(response.body));
    expect(body.enabled).toBe(true);
    if (body.enabled) {
      expect(body.current_day).toBe(1);
      expect(body.day_status).toBe("success");
      expect(body.preview_next_day).toBe(2);
      expect(body.lesson.day_number).toBe(1);
    }
  });

  it("rejects completion when watched_sec is below 80%", async () => {
    const auth = await createOnboardedUser("english-watch@example.com");
    await enableEnglish(auth.access_token);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/english/complete",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { watched_sec: 479 },
    });

    expect(response.statusCode).toBe(400);
  });

  it.skipIf(!hasTwoPriorDaysInWeek())("rejects the third skip in the same week", async () => {
    const today = getUserLocalDate(new Date(), TIMEZONE);
    const weekStart = getWeekStartMonday(today);
    const priorDates = listDatesInclusive(weekStart, today).filter((date) => date < today);

    const auth = await createOnboardedUser("english-skip@example.com");
    await enableEnglish(auth.access_token);

    const [lesson] = await db
      .select()
      .from(englishLessons)
      .where(eq(englishLessons.dayNumber, 1))
      .limit(1);
    const [storedSettings] = await db.select().from(englishSettings).limit(1);

    for (const date of priorDates.slice(-2)) {
      await db.insert(englishProgress).values({
        userId: storedSettings!.userId,
        lessonId: lesson!.id,
        date,
        status: "skipped",
      });
    }

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/english/skip",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects completion after skip on the same day", async () => {
    const auth = await createOnboardedUser("english-skip-complete@example.com");
    await enableEnglish(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    await app.inject({
      method: "POST",
      url: "/api/v1/english/skip",
      headers,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/english/complete",
      headers,
      payload: { watched_sec: 480 },
    });

    expect(response.statusCode).toBe(400);
  });

  it("does not advance preview_next_day after skip", async () => {
    const auth = await createOnboardedUser("english-skip-preview@example.com");
    await enableEnglish(auth.access_token);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/english/skip",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = englishSkipResponseSchema.parse(JSON.parse(response.body));
    expect(body.current_day).toBe(1);
    expect(body.preview_next_day).toBe(1);

    const [settings] = await db.select().from(englishSettings);
    expect(settings?.currentDay).toBe(1);
  });

  it("returns 404 for complete when the module is disabled", async () => {
    const auth = await createOnboardedUser("english-404@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/english/complete",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { watched_sec: 480 },
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns completed lessons in history", async () => {
    const auth = await createOnboardedUser("english-history@example.com");
    await enableEnglish(auth.access_token);

    await app.inject({
      method: "POST",
      url: "/api/v1/english/complete",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { watched_sec: 480 },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/english/history",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = englishHistoryResponseSchema.parse(JSON.parse(response.body));
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.status).toBe("success");
    expect(body.items[0]?.lesson?.day_number).toBe(1);
  });

  it("can disable the module via settings", async () => {
    const auth = await createOnboardedUser("english-disable@example.com");
    await enableEnglish(auth.access_token);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/english/settings",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { is_enabled: false },
    });

    const body = englishSettingsResponseSchema.parse(JSON.parse(response.body));
    expect(body.is_enabled).toBe(false);

    const todayResponse = await app.inject({
      method: "GET",
      url: "/api/v1/english/today",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const today = englishTodayResponseSchema.parse(JSON.parse(todayResponse.body));
    expect(today.enabled).toBe(false);
  });
});
