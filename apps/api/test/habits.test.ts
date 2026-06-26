import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { authResponseSchema, habitResponseSchema, MAX_ACTIVE_HABITS, MAX_LIGHT_HABITS } from "@mytodo/shared";
import { habits } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Habits", () => {
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
    await app?.close();
  });

  async function createOnboardedUser(email = "habits@example.com", freeTimeMin = 60) {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Habit User",
        age: 28,
        gender: "female",
      },
    });

    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        weight_kg: 65,
        height_cm: 170,
        free_time_min: freeTimeMin,
        wake_time: "07:00",
        sleep_time: "23:00",
      },
    });

    return auth;
  }

  it("stores category_key for custom habits", async () => {
    const auth = await createOnboardedUser("custom-category@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        name: "Медитация",
        unit: "minutes",
        baseline_value: 1,
        category_key: "meditation",
      },
    });

    expect(response.statusCode).toBe(201);

    const habit = habitResponseSchema.parse(JSON.parse(response.body));
    expect(habit.category_key).toBe("meditation");

    const [storedHabit] = await db.select().from(habits).where(eq(habits.id, habit.id));
    expect(storedHabit?.categoryKey).toBe("meditation");
  });

  it("uses category_key to personalize custom light goals", async () => {
    const auth = await createOnboardedUser("custom-goals@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const meditationResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        name: "Короткая пауза",
        unit: "minutes",
        baseline_value: 0,
        category_key: "meditation",
      },
    });
    expect(meditationResponse.statusCode).toBe(201);
    const meditation = habitResponseSchema.parse(JSON.parse(meditationResponse.body));
    expect(meditation.current_goal).toBe(1);

    const languageResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        name: "Английский для работы",
        unit: "minutes",
        baseline_value: 0,
        category_key: "language",
      },
    });
    expect(languageResponse.statusCode).toBe(201);
    const language = habitResponseSchema.parse(JSON.parse(languageResponse.body));
    expect(language.current_goal).toBe(25);
  });

  it("rejects habit creation before onboarding", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "new@example.com",
        password: "password123",
        name: "New User",
        age: 20,
        gender: "male",
      },
    });

    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        template_id: "books",
        baseline_value: 5,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("creates template and custom habits with calibrated goals", async () => {
    const auth = await createOnboardedUser();

    const booksResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        template_id: "books",
        baseline_value: 5,
      },
    });

    expect(booksResponse.statusCode).toBe(201);
    const books = habitResponseSchema.parse(JSON.parse(booksResponse.body));
    expect(books.current_goal).toBe(5);
    expect(books.template_id).toBe("books");
    expect(books.progression_interval_days).toBe(3);
    expect(books.allows_weekly_skip).toBe(true);

    const customResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        name: "Blender 3D",
        unit: "minutes",
        baseline_value: 20,
      },
    });

    expect(customResponse.statusCode).toBe(201);
    const custom = habitResponseSchema.parse(JSON.parse(customResponse.body));
    expect(custom.is_custom).toBe(true);
    expect(custom.current_goal).toBe(20);
    expect(custom.growth_step).toBe(5);
    expect(custom.progression_interval_days).toBe(3);

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/habits?side=light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });
    const lightHabits = habitResponseSchema.array().parse(JSON.parse(listResponse.body));
    const booksAfter = lightHabits.find((habit) => habit.template_id === "books");
    expect(booksAfter?.current_goal).toBe(5);
  });

  it("creates nail biting as abstinence with relapse timer", async () => {
    const auth = await createOnboardedUser("nails@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        template_id: "nail_biting",
      },
    });

    expect(response.statusCode).toBe(201);
    const habit = habitResponseSchema.parse(JSON.parse(response.body));
    expect(habit.type).toBe("abstinence");
    expect(habit.phase).toBe("abstinence");
    expect(habit.last_relapse_at).toBeTruthy();
    expect(habit.current_goal).toBe(0);
  });

  it("allows multiple light habits regardless of free time budget", async () => {
    const auth = await createOnboardedUser("light-limit@example.com", 15);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        template_id: "books",
        baseline_value: 5,
      },
    });

    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        template_id: "running",
        baseline_value: 10,
      },
    });

    expect(second.statusCode).toBe(201);
  });

  it("rejects habit when active habit limit is reached", async () => {
    const auth = await createOnboardedUser("limit@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    for (let i = 0; i < MAX_LIGHT_HABITS; i += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/habits",
        headers,
        payload: {
          name: `Custom light ${i}`,
          unit: "minutes",
          baseline_value: 10,
        },
      });
      expect(response.statusCode).toBe(201);
    }

    const darkTemplates = ["smoking", "sugar", "sweets", "social_media", "nail_biting"] as const;
    const darkSlots = MAX_ACTIVE_HABITS - MAX_LIGHT_HABITS;
    for (let i = 0; i < darkSlots; i += 1) {
      const templateId = darkTemplates[i];
      if (!templateId) {
        throw new Error(`Expected dark template at index ${i}`);
      }
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/habits",
        headers,
        payload: {
          template_id: templateId,
          ...(templateId === "nail_biting" ? {} : { baseline_value: 5 + i }),
        },
      });
      expect(response.statusCode).toBe(201);
    }

    const overLimit = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        name: "One too many",
        unit: "minutes",
        baseline_value: 10,
      },
    });

    expect(overLimit.statusCode).toBe(400);
  });

  it("snapshots harshness_level from profile at creation time", async () => {
    const auth = await createOnboardedUser("harshness@example.com");

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { harshness_level: 3 },
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        template_id: "smoking",
        baseline_value: 20,
      },
    });

    const habit = habitResponseSchema.parse(JSON.parse(createResponse.body));
    expect(habit.harshness_level).toBe(3);

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { harshness_level: 1 },
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/habits?side=dark",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const listed = habitResponseSchema.array().parse(JSON.parse(listResponse.body));
    expect(listed[0]?.harshness_level).toBe(3);
  });

  it("recalibrates remaining light habits when one is deactivated", async () => {
    const auth = await createOnboardedUser("recalibrate@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const booksResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        template_id: "books",
        baseline_value: 5,
      },
    });
    const books = habitResponseSchema.parse(JSON.parse(booksResponse.body));

    const customResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        name: "Blender 3D",
        unit: "minutes",
        baseline_value: 20,
      },
    });
    const custom = habitResponseSchema.parse(JSON.parse(customResponse.body));
    expect(custom.current_goal).toBe(20);

    const listBefore = await app.inject({
      method: "GET",
      url: "/api/v1/habits?side=light",
      headers,
    });
    const lightBefore = habitResponseSchema.array().parse(JSON.parse(listBefore.body));
    const booksBefore = lightBefore.find((habit) => habit.id === books.id);
    expect(booksBefore?.current_goal).toBe(5);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/habits/${custom.id}`,
      headers,
    });
    expect(deleteResponse.statusCode).toBe(200);

    const listAfter = await app.inject({
      method: "GET",
      url: "/api/v1/habits?side=light",
      headers,
    });
    const lightAfter = habitResponseSchema.array().parse(JSON.parse(listAfter.body));
    expect(lightAfter).toHaveLength(1);
    expect(lightAfter[0]?.current_goal).toBe(5);
  });

  it("rejects manual goal changes for abstinence habits", async () => {
    const auth = await createOnboardedUser("abstinence-goal@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "nail_biting" },
    });
    const habit = habitResponseSchema.parse(JSON.parse(createResponse.body));

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/habits/${habit.id}`,
      headers,
      payload: { current_goal: 5 },
    });

    expect(patchResponse.statusCode).toBe(400);
  });

  it("lists, patches goal, and deactivates habits", async () => {
    const auth = await createOnboardedUser("crud@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        template_id: "smoking",
        baseline_value: 20,
      },
    });

    const created = habitResponseSchema.parse(JSON.parse(createResponse.body));

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/habits?side=dark",
      headers,
    });

    expect(listResponse.statusCode).toBe(200);
    const list = habitResponseSchema.array().parse(JSON.parse(listResponse.body));
    expect(list).toHaveLength(1);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/habits/${created.id}`,
      headers,
      payload: { current_goal: 15 },
    });

    expect(patchResponse.statusCode).toBe(200);
    expect(habitResponseSchema.parse(JSON.parse(patchResponse.body)).current_goal).toBe(15);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/habits/${created.id}`,
      headers,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(habitResponseSchema.parse(JSON.parse(deleteResponse.body)).is_active).toBe(false);

    const afterDeleteList = await app.inject({
      method: "GET",
      url: "/api/v1/habits",
      headers,
    });
    expect(habitResponseSchema.array().parse(JSON.parse(afterDeleteList.body))).toHaveLength(0);
  });
});
