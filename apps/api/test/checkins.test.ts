import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import {
  authResponseSchema,
  checkinResponseSchema,
  habitResponseSchema,
} from "@mytodo/shared";
import { habits } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Checkins", () => {
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

  async function createOnboardedUser(email = "checkins@example.com") {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Checkin User",
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

  async function createLightHabit(token: string) {
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

  async function createDarkHabit(token: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: "smoking",
        baseline_value: 20,
      },
    });

    return habitResponseSchema.parse(JSON.parse(response.body));
  }

  it("records dark limit success with unchanged preview_next_goal until interval met", async () => {
    const auth = await createOnboardedUser("dark-success@example.com");
    const habit = await createDarkHabit(auth.access_token);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 18,
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.status).toBe("success");
    expect(checkin.preview_next_goal).toBe(20);
    expect(habit.progression_interval_days).toBe(3);
  });

  it("decreases dark limit preview_next_goal after third successful day", async () => {
    const auth = await createOnboardedUser("dark-interval@example.com");
    const habit = await createDarkHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    await db
      .update(habits)
      .set({ successDaysAtGoal: 2 })
      .where(eq(habits.id, habit.id));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-20",
        value: 18,
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.preview_next_goal).toBe(19);
  });

  it("caps social media preview_next_goal at 15 minutes", async () => {
    const auth = await createOnboardedUser("social@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: {
        template_id: "social_media",
        baseline_value: 18,
      },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));
    expect(habit.current_goal).toBe(18);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 10,
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.status).toBe("success");
    expect(checkin.preview_next_goal).toBe(15);
  });

  it("rejects skip on dark habits", async () => {
    const auth = await createOnboardedUser("dark-skip@example.com");
    const habit = await createDarkHabit(auth.access_token);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        status: "skipped",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("records light habit success with unchanged preview_next_goal until interval met", async () => {
    const auth = await createOnboardedUser("light-interval@example.com");
    const habit = await createLightHabit(auth.access_token);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: habit.current_goal,
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.status).toBe("success");
    expect(checkin.preview_next_goal).toBe(habit.current_goal);
    expect(habit.progression_interval_days).toBe(3);
  });

  it("increases light preview_next_goal after third successful day", async () => {
    const auth = await createOnboardedUser("light-third@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    await db
      .update(habits)
      .set({ successDaysAtGoal: 2 })
      .where(eq(habits.id, habit.id));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-20",
        value: habit.current_goal,
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.preview_next_goal).toBe(habit.current_goal + habit.growth_step);
  });

  it("records light habit success without changing current_goal", async () => {
    const auth = await createOnboardedUser();
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 120,
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.status).toBe("success");
    expect(checkin.current_goal).toBe(5);
    expect(checkin.preview_next_goal).toBe(5);

    const [storedHabit] = await db.select().from(habits).where(eq(habits.id, habit.id));
    expect(Number(storedHabit?.currentGoal)).toBe(5);
  });

  it("records dark limit fail when value exceeds goal", async () => {
    const auth = await createOnboardedUser("dark@example.com");
    const habit = await createDarkHabit(auth.access_token);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 21,
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.status).toBe("fail");
    expect(checkin.preview_next_goal).toBe(20);
  });

  it("rejects the third skip in the same week", async () => {
    const auth = await createOnboardedUser("skip@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    for (const date of ["2026-06-15", "2026-06-16"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/checkins",
        headers,
        payload: {
          habit_id: habit.id,
          date,
          status: "skipped",
        },
      });
      expect(response.statusCode).toBe(201);
    }

    const third = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        status: "skipped",
      },
    });

    expect(third.statusCode).toBe(400);
  });

  it("records abstinence relapse and updates last_relapse_at", async () => {
    const auth = await createOnboardedUser("nails@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "nail_biting" },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));
    const beforeRelapse = habit.last_relapse_at;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        status: "fail",
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.status).toBe("fail");

    const [storedHabit] = await db.select().from(habits).where(eq(habits.id, habit.id));
    expect(storedHabit?.lastRelapseAt?.toISOString()).not.toBe(beforeRelapse);
  });

  it("lists checkins for a date", async () => {
    const auth = await createOnboardedUser("list@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 120,
      },
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/checkins?date=2026-06-18",
      headers,
    });

    expect(listResponse.statusCode).toBe(200);
    const items = checkinResponseSchema.array().parse(JSON.parse(listResponse.body));
    expect(items).toHaveLength(1);
    expect(items[0]?.habit_id).toBe(habit.id);
  });

  it("returns 200 when updating an existing checkin", async () => {
    const auth = await createOnboardedUser("update@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 50,
      },
    });
    expect(createResponse.statusCode).toBe(201);

    const updateResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 120,
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const checkin = checkinResponseSchema.parse(JSON.parse(updateResponse.body));
    expect(checkin.status).toBe("success");
    expect(checkin.value).toBe(120);
  });

  it("rejects duplicate habit_id and date in batch", async () => {
    const auth = await createOnboardedUser("batch-dup@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins/batch",
      headers,
      payload: {
        checkins: [
          { habit_id: habit.id, date: "2026-06-18", value: 50 },
          { habit_id: habit.id, date: "2026-06-18", value: 120 },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects duplicate habit_id without date in batch (same today)", async () => {
    const auth = await createOnboardedUser("batch-dup-today@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins/batch",
      headers,
      payload: {
        checkins: [
          { habit_id: habit.id, value: 50 },
          { habit_id: habit.id, value: 120 },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("records light habit fail with unchanged preview_next_goal", async () => {
    const auth = await createOnboardedUser("light-fail@example.com");
    const habit = await createLightHabit(auth.access_token);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 2,
      },
    });

    expect(response.statusCode).toBe(201);
    const checkin = checkinResponseSchema.parse(JSON.parse(response.body));
    expect(checkin.status).toBe("fail");
    expect(checkin.preview_next_goal).toBe(5);
  });

  it("returns 409 when batch omits updated_at for an existing checkin", async () => {
    const auth = await createOnboardedUser("batch-no-ts@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 120,
      },
    });

    const batchResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins/batch",
      headers,
      payload: {
        checkins: [
          {
            habit_id: habit.id,
            date: "2026-06-18",
            value: 50,
          },
        ],
      },
    });

    expect(batchResponse.statusCode).toBe(409);
  });

  it("returns 409 when batch item is older than server checkin", async () => {
    const auth = await createOnboardedUser("batch@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: {
        habit_id: habit.id,
        date: "2026-06-18",
        value: 120,
      },
    });
    const saved = checkinResponseSchema.parse(JSON.parse(first.body));

    const batchResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins/batch",
      headers,
      payload: {
        checkins: [
          {
            habit_id: habit.id,
            date: "2026-06-18",
            value: 55,
            updated_at: "2020-01-01T00:00:00.000Z",
          },
        ],
      },
    });

    expect(batchResponse.statusCode).toBe(409);
    const body = JSON.parse(batchResponse.body) as {
      error: { details: { conflicts: Array<{ habit_id: string }> } };
    };
    expect(body.error.details.conflicts[0]?.habit_id).toBe(habit.id);
    expect(saved.status).toBe("success");
  });

  it("applies batch checkins when there is no conflict", async () => {
    const auth = await createOnboardedUser("batch-ok@example.com");
    const habit = await createLightHabit(auth.access_token);
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins/batch",
      headers,
      payload: {
        checkins: [
          {
            habit_id: habit.id,
            date: "2026-06-18",
            value: 120,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { checkins: unknown[] };
    expect(body.checkins).toHaveLength(1);
  });
});
