import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  authResponseSchema,
  subscribeResponseSchema,
  subscriptionResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { MockYukassaClient } from "../src/lib/yukassa/mock-client.js";
import { BillingService } from "../src/services/billing.js";
import { subscriptions, users } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Billing", () => {
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
    billingService = new BillingService(db, yukassa);
    await app.ready();
  });

  beforeEach(async () => {
    await truncateAuthTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(email = "billing@example.com") {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Billing User",
        age: 30,
        gender: "male",
      },
    });

    return authResponseSchema.parse(JSON.parse(response.body));
  }

  async function completeOnboarding(token: string) {
    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        weight_kg: 80,
        height_cm: 180,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
      },
    });
  }

  it("creates a YuKassa payment for subscribe", async () => {
    const auth = await registerUser();
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/billing/subscribe",
      headers,
      payload: { plan: "monthly" },
    });

    expect(response.statusCode).toBe(201);
    const body = subscribeResponseSchema.parse(JSON.parse(response.body));
    expect(body.plan).toBe("monthly");
    expect(body.amount_rub).toBe(1990);
    expect(body.confirmation_url).toContain("mock-pay-");
  });

  it("activates subscription from webhook and grants access after trial", async () => {
    const auth = await registerUser();
    const headers = { authorization: `Bearer ${auth.access_token}` };
    await completeOnboarding(auth.access_token);

    const subscribeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/billing/subscribe",
      headers,
      payload: { plan: "2months" },
    });
    const subscribe = subscribeResponseSchema.parse(JSON.parse(subscribeResponse.body));

    yukassa.succeedPayment(subscribe.payment_id);
    const webhookPayload = yukassa.buildWebhookEvent(subscribe.payment_id, "payment.succeeded");

    const webhookResponse = await app.inject({
      method: "POST",
      url: "/api/v1/billing/webhook",
      payload: webhookPayload,
    });
    expect(webhookResponse.statusCode).toBe(200);

    await db
      .update(users)
      .set({ trialEndsAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(users.email, "billing@example.com"));

    const checkinProbe = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    expect(checkinProbe.statusCode).toBe(201);

    const habit = JSON.parse(checkinProbe.body);
    const checkinResponse = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: habit.id, value: habit.current_goal },
    });
    expect(checkinResponse.statusCode).toBe(201);

    const [subscription] = await db.select().from(subscriptions);
    expect(subscription?.status).toBe("active");
    expect(subscription?.plan).toBe("2months");
  });

  it("is idempotent for duplicate webhook delivery", async () => {
    const auth = await registerUser("idempotent-billing@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const subscribeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/billing/subscribe",
      headers,
      payload: { plan: "monthly" },
    });
    const subscribe = subscribeResponseSchema.parse(JSON.parse(subscribeResponse.body));
    yukassa.succeedPayment(subscribe.payment_id);
    const webhookPayload = yukassa.buildWebhookEvent(subscribe.payment_id, "payment.succeeded");

    await app.inject({ method: "POST", url: "/api/v1/billing/webhook", payload: webhookPayload });
    await app.inject({ method: "POST", url: "/api/v1/billing/webhook", payload: webhookPayload });

    const rows = await db.select().from(subscriptions);
    expect(rows).toHaveLength(1);
  });

  it("returns 402 when trial expired and no subscription", async () => {
    const auth = await registerUser("expired-trial@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };
    await completeOnboarding(auth.access_token);

    await db
      .update(users)
      .set({ trialEndsAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(users.email, "expired-trial@example.com"));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers,
    });

    expect(response.statusCode).toBe(402);
  });

  it("cancels monthly subscription but keeps access until period end", async () => {
    const auth = await registerUser("cancel-monthly@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const subscribeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/billing/subscribe",
      headers,
      payload: { plan: "monthly" },
    });
    const subscribe = subscribeResponseSchema.parse(JSON.parse(subscribeResponse.body));
    yukassa.succeedPayment(subscribe.payment_id, "pm-monthly");
    await app.inject({
      method: "POST",
      url: "/api/v1/billing/webhook",
      payload: yukassa.buildWebhookEvent(subscribe.payment_id, "payment.succeeded"),
    });

    await db
      .update(users)
      .set({ trialEndsAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(users.email, "cancel-monthly@example.com"));

    const cancelResponse = await app.inject({
      method: "POST",
      url: "/api/v1/billing/cancel",
      headers,
    });
    const canceled = subscriptionResponseSchema.parse(JSON.parse(cancelResponse.body));
    expect(canceled.status).toBe("canceled");

    const todayResponse = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers,
    });
    expect(todayResponse.statusCode).toBe(200);
  });

  it("rejects cancel for non-monthly plans", async () => {
    const auth = await registerUser("cancel-fixed@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };

    const subscribeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/billing/subscribe",
      headers,
      payload: { plan: "3months" },
    });
    const subscribe = subscribeResponseSchema.parse(JSON.parse(subscribeResponse.body));
    yukassa.succeedPayment(subscribe.payment_id);
    await app.inject({
      method: "POST",
      url: "/api/v1/billing/webhook",
      payload: yukassa.buildWebhookEvent(subscribe.payment_id, "payment.succeeded"),
    });

    const cancelResponse = await app.inject({
      method: "POST",
      url: "/api/v1/billing/cancel",
      headers,
    });
    expect(cancelResponse.statusCode).toBe(400);
  });

  it("denies access when fixed-term subscription period ends", async () => {
    const auth = await registerUser("fixed-term@example.com");
    const headers = { authorization: `Bearer ${auth.access_token}` };
    await completeOnboarding(auth.access_token);

    await db.insert(subscriptions).values({
      userId: auth.user.id,
      plan: "2months",
      status: "active",
      currentPeriodEnd: new Date("2020-01-01T00:00:00Z"),
    });

    await db
      .update(users)
      .set({ trialEndsAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(users.id, auth.user.id));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/today/light",
      headers,
    });
    expect(response.statusCode).toBe(402);
  });

  it("expires fixed-term subscriptions via worker lifecycle", async () => {
    const auth = await registerUser("expire-fixed@example.com");

    await db.insert(subscriptions).values({
      userId: auth.user.id,
      plan: "3months",
      status: "active",
      currentPeriodEnd: new Date("2020-01-01T00:00:00Z"),
    });

    await billingService.processEndedSubscriptions(new Date("2026-06-19T12:00:00Z"));

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, auth.user.id));
    expect(subscription?.status).toBe("expired");
  });

  it("expires past_due subscription after max retries", async () => {
    const auth = await registerUser("past-due@example.com");

    await db.insert(subscriptions).values({
      userId: auth.user.id,
      plan: "monthly",
      status: "past_due",
      currentPeriodEnd: new Date("2026-07-01T00:00:00Z"),
      yukassaPaymentMethodId: "pm-test",
      pastDueRetryCount: 3,
      lastPaymentFailedAt: new Date("2020-01-01T00:00:00Z"),
    });

    await billingService.processPastDueRetries(new Date("2026-06-19T12:00:00Z"));

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, auth.user.id));
    expect(subscription?.status).toBe("expired");
  });
});
