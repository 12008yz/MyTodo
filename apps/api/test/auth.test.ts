import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { authResponseSchema, userProfileSchema } from "@mytodo/shared";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

const testUser = {
  email: "test@example.com",
  password: "password123",
  name: "Test User",
  age: 25,
  gender: "male" as const,
};

describe("Auth and profile", () => {
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

  async function registerUser() {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: testUser,
    });

    expect(response.statusCode).toBe(201);
    return authResponseSchema.parse(JSON.parse(response.body));
  }

  it("registers, logs in, and returns profile with trial_ends_at", async () => {
    const registered = await registerUser();
    expect(registered.user.onboarding_completed).toBe(false);
    expect(registered.user.trial_ends_at).toBeTruthy();

    const trialEndsAt = new Date(registered.user.trial_ends_at);
    const diffDays = (trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(2.9);
    expect(diffDays).toBeLessThan(3.1);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: {
        authorization: `Bearer ${registered.access_token}`,
      },
    });

    expect(meResponse.statusCode).toBe(200);
    const me = userProfileSchema.parse(JSON.parse(meResponse.body));
    expect(me.email).toBe(testUser.email);
    expect(me.trial_ends_at).toBe(registered.user.trial_ends_at);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loggedIn = authResponseSchema.parse(JSON.parse(loginResponse.body));
    expect(loggedIn.user.id).toBe(registered.user.id);
  });

  it("rotates refresh token and invalidates old refresh on logout", async () => {
    const registered = await registerUser();

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refresh_token: registered.refresh_token },
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshed = authResponseSchema.parse(JSON.parse(refreshResponse.body));
    expect(refreshed.refresh_token).not.toBe(registered.refresh_token);

    const oldRefreshResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refresh_token: registered.refresh_token },
    });
    expect(oldRefreshResponse.statusCode).toBe(401);

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: { refresh_token: refreshed.refresh_token },
    });
    expect(logoutResponse.statusCode).toBe(204);

    const afterLogoutResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refresh_token: refreshed.refresh_token },
    });
    expect(afterLogoutResponse.statusCode).toBe(401);
  });

  it("completes onboarding and computes daily_budget_min", async () => {
    const registered = await registerUser();

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: {
        authorization: `Bearer ${registered.access_token}`,
      },
      payload: {
        weight_kg: 75,
        height_cm: 180,
        free_time_min: 45,
        wake_time: "07:00",
        sleep_time: "23:00",
        timezone: "Europe/Moscow",
        pomodoro_work_min: 25,
        harshness_level: 2,
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const profile = userProfileSchema.parse(JSON.parse(patchResponse.body));
    expect(profile.onboarding_completed).toBe(true);
    expect(profile.daily_budget_min).toBe(45);
    expect(profile.free_time_min).toBe(45);
  });

  it("caps daily_budget_min at 60 when free_time_min is higher", async () => {
    const registered = await registerUser();

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: {
        authorization: `Bearer ${registered.access_token}`,
      },
      payload: {
        weight_kg: 70,
        height_cm: 175,
        free_time_min: 120,
        wake_time: "06:30",
        sleep_time: "22:30",
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const profile = userProfileSchema.parse(JSON.parse(patchResponse.body));
    expect(profile.daily_budget_min).toBe(60);
    expect(profile.free_time_min).toBe(120);
  });

  it("rejects duplicate registration and unauthorized profile access", async () => {
    await registerUser();

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: testUser,
    });
    expect(duplicate.statusCode).toBe(409);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/v1/me",
    });
    expect(meResponse.statusCode).toBe(401);
  });

  it("normalizes email and completes onboarding across multiple patches", async () => {
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        ...testUser,
        email: "  MixedCase@Example.COM  ",
      },
    });
    expect(registered.statusCode).toBe(201);
    const auth = authResponseSchema.parse(JSON.parse(registered.body));
    expect(auth.user.email).toBe("mixedcase@example.com");

    const stepOne = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: {
        weight_kg: 80,
        height_cm: 182,
        wake_time: "08:00",
        sleep_time: "00:00",
      },
    });
    expect(stepOne.statusCode).toBe(200);
    expect(userProfileSchema.parse(JSON.parse(stepOne.body)).onboarding_completed).toBe(false);

    const stepTwo = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.access_token}` },
      payload: { free_time_min: 50, timezone: "Asia/Vladivostok" },
    });
    expect(stepTwo.statusCode).toBe(200);
    const profile = userProfileSchema.parse(JSON.parse(stepTwo.body));
    expect(profile.onboarding_completed).toBe(true);
    expect(profile.daily_budget_min).toBe(50);
    expect(profile.timezone).toBe("Europe/Moscow");
    expect(profile.pending_timezone).toBe("Asia/Vladivostok");
    expect(profile.pending_timezone_from).toBeTruthy();
  });
});
