import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import {
  authResponseSchema,
  habitNutritionLogSchema,
  nutritionTodayResponseSchema,
} from "@mytodo/shared";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Nutrition logs", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];

  beforeAll(async () => {
    await ensureMigrated(env);
    const built = await buildApp({ env });
    app = built.app;
    await app.ready();
  });

  beforeEach(async () => {
    await truncateAuthTables(app.db);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createUserWithNutritionHabit() {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `nutrition-${Date.now()}@example.com`,
        password: "password123",
        name: "Nutrition User",
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
        height_cm: 175,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
      },
    });

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        name: "Правильное питание",
        unit: "minutes",
        baseline_value: 0,
        category_key: "healthy_nutrition",
      },
    });

    const habit = JSON.parse(habitResponse.body);

    return { auth, habitId: habit.id as string };
  }

  it("GET /nutrition/today returns null when no log", async () => {
    const { auth, habitId } = await createUserWithNutritionHabit();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habitId}/nutrition/today`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = nutritionTodayResponseSchema.parse(JSON.parse(response.body));
    expect(body.log).toBeNull();
  });

  it("PUT /nutrition/today saves ingredients and recipe", async () => {
    const { auth, habitId } = await createUserWithNutritionHabit();

    const putResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habitId}/nutrition/today`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        ingredient_ids: ["egg", "tomato"],
        recipe_id: "veg-omelet",
      },
    });

    expect(putResponse.statusCode).toBe(200);
    const log = habitNutritionLogSchema.parse(JSON.parse(putResponse.body));
    expect(log.ingredient_ids).toEqual(["egg", "tomato"]);
    expect(log.recipe_id).toBe("veg-omelet");

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/v1/habits/${habitId}/nutrition/today`,
      headers: { authorization: `Bearer ${auth.access_token}` },
    });

    const body = nutritionTodayResponseSchema.parse(JSON.parse(getResponse.body));
    expect(body.log?.recipe_id).toBe("veg-omelet");
  });

  it("rejects fewer than two ingredient ids", async () => {
    const { auth, habitId } = await createUserWithNutritionHabit();

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habitId}/nutrition/today`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        ingredient_ids: ["egg"],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects unknown ingredient ids", async () => {
    const { auth, habitId } = await createUserWithNutritionHabit();

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/habits/${habitId}/nutrition/today`,
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        ingredient_ids: ["egg", "unicorn-meat"],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
