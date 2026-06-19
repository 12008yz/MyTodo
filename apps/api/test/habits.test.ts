import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { authResponseSchema, habitResponseSchema } from "@mytodo/shared";
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
    await app.close();
  });

  async function createOnboardedUser(email = "habits@example.com") {
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
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
      },
    });

    return auth;
  }

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
    expect(books.current_goal).toBe(120);
    expect(books.template_id).toBe("books");
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
    expect(custom.current_goal).toBe(30);
    expect(custom.growth_step).toBe(5);

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/habits?side=light",
      headers: { authorization: `Bearer ${auth.access_token}` },
    });
    const lightHabits = habitResponseSchema.array().parse(JSON.parse(listResponse.body));
    const booksAfter = lightHabits.find((habit) => habit.template_id === "books");
    expect(booksAfter?.current_goal).toBe(60);
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

  it("rejects the 7th active habit", async () => {
    const auth = await createOnboardedUser("limit@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    for (let i = 0; i < 6; i += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/habits",
        headers,
        payload: {
          name: `Custom ${i}`,
          unit: "minutes",
          baseline_value: 10,
        },
      });
      expect(response.statusCode).toBe(201);
    }

    const seventh = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        name: "One too many",
        unit: "minutes",
        baseline_value: 10,
      },
    });

    expect(seventh.statusCode).toBe(400);
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
    expect(custom.current_goal).toBe(30);

    const listBefore = await app.inject({
      method: "GET",
      url: "/api/v1/habits?side=light",
      headers,
    });
    const lightBefore = habitResponseSchema.array().parse(JSON.parse(listBefore.body));
    const booksBefore = lightBefore.find((habit) => habit.id === books.id);
    expect(booksBefore?.current_goal).toBe(60);

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
    expect(lightAfter[0]?.current_goal).toBe(120);
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
