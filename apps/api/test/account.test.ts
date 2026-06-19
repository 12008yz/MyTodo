import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import AdmZip from "adm-zip";
import {
  authResponseSchema,
  habitResponseSchema,
  userProfileSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { MockYukassaClient } from "../src/lib/yukassa/mock-client.js";
import { BillingService } from "../src/services/billing.js";
import { PledgeService } from "../src/services/pledges.js";
import { pledges, users } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Account export, delete, silence", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];
  let db: Awaited<ReturnType<typeof buildApp>>["app"]["db"];
  let yukassa: MockYukassaClient;
  let billingService: BillingService;

  beforeAll(async () => {
    await ensureMigrated(env);
    yukassa = new MockYukassaClient();
    const built = await buildApp({ env, yukassaClient: yukassa });
    app = built.app;
    db = built.app.db;
    const pledgeService = new PledgeService(db, yukassa);
    billingService = new BillingService(db, yukassa, pledgeService);
    await app.ready();
  });

  beforeEach(async () => {
    await truncateAuthTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAndOnboard(email = "account@example.com") {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Account User",
        age: 30,
        gender: "male",
      },
    });
    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));
    const headers = { authorization: `Bearer ${auth.access_token}` };

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers,
      payload: {
        weight_kg: 80,
        height_cm: 180,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
        harshness_level: 3,
      },
    });

    return { auth, headers };
  }

  async function activatePledge(headers: Record<string, string>, habitId: string) {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/pledges",
      headers,
      payload: { habit_id: habitId, charity_fund: "children" },
    });
    const payment = JSON.parse(createResponse.body) as { payment_id: string };
    yukassa.succeedPayment(payment.payment_id);
    await billingService.handleWebhook(
      JSON.stringify(yukassa.buildWebhookEvent(payment.payment_id, "payment.succeeded")),
      undefined,
    );
  }

  it("exports user data as zip without secrets", async () => {
    const { headers } = await registerAndOnboard();

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: habit.id, value: 10 },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me/export",
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/zip");

    const zip = new AdmZip(Buffer.from(response.rawPayload));
    const names = zip.getEntries().map((entry) => entry.entryName).sort();
    expect(names).toEqual([
      "checkins.csv",
      "english_progress.csv",
      "habits.csv",
      "profile.json",
    ]);

    const profile = JSON.parse(zip.readAsText("profile.json")) as Record<string, unknown>;
    expect(profile.email).toBe("account@example.com");
    expect(profile).not.toHaveProperty("password_hash");
    expect(profile).not.toHaveProperty("access_token");

    const checkinsCsv = zip.readAsText("checkins.csv");
    expect(checkinsCsv).toContain(habit.id);
  });

  it("DELETE /me removes account when pledge was active", async () => {
    const { headers } = await registerAndOnboard("delete-only@example.com");

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));
    await activatePledge(headers, habit.id);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/api/v1/me",
      headers,
    });
    expect(deleteResponse.statusCode).toBe(204);

    const remainingUsers = await db.select().from(users);
    expect(remainingUsers).toHaveLength(0);
  });

  it("failAllActiveForUser marks pledges failed", async () => {
    const { headers, auth } = await registerAndOnboard("delete-pledge@example.com");

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));
    await activatePledge(headers, habit.id);

    const [activePledge] = await db.select().from(pledges);
    expect(activePledge?.status).toBe("active");

    const pledgeService = new PledgeService(db, yukassa);
    await pledgeService.failAllActiveForUser(auth.user.id);
    const [failedPledge] = await db.select().from(pledges);
    expect(failedPledge?.status).toBe("failed");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/api/v1/me",
      headers,
    });
    expect(deleteResponse.statusCode).toBe(204);

    const remainingUsers = await db.select().from(users);
    expect(remainingUsers).toHaveLength(0);
  });

  it("enables silence mode and softens harshness in profile", async () => {
    const { headers } = await registerAndOnboard("silence@example.com");

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers,
      payload: { enable_silence_mode: true },
    });

    expect(response.statusCode).toBe(200);
    const profile = userProfileSchema.parse(JSON.parse(response.body));
    expect(profile.silence_mode_active).toBe(true);
    expect(profile.silence_mode_until).toBeTruthy();
    expect(profile.effective_harshness_level).toBe(1);
    expect(profile.harshness_level).toBe(3);
  });

  it("rejects second silence mode within 30 days", async () => {
    const { headers } = await registerAndOnboard("silence-twice@example.com");

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers,
      payload: { enable_silence_mode: true },
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers,
      payload: { enable_silence_mode: true },
    });

    expect(response.statusCode).toBe(400);
  });

  it("defers timezone change until the next local day", async () => {
    const { headers } = await registerAndOnboard("timezone@example.com");

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers,
      payload: { timezone: "Asia/Yekaterinburg" },
    });

    expect(response.statusCode).toBe(200);
    const profile = userProfileSchema.parse(JSON.parse(response.body));
    expect(profile.timezone).toBe("Europe/Moscow");
    expect(profile.pending_timezone).toBe("Asia/Yekaterinburg");
    expect(profile.pending_timezone_from).toBeTruthy();
  });
});
