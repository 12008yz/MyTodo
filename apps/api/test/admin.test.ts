import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  adminEnglishLessonsResponseSchema,
  adminPushBroadcastResponseSchema,
  adminUserDetailSchema,
  adminUsersListResponseSchema,
  createPledgePaymentResponseSchema,
  authResponseSchema,
  ENGLISH_LESSON_COUNT,
  englishLessonSchema,
  habitResponseSchema,
  pledgeResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { MockWebPushClient } from "../src/lib/web-push/mock-client.js";
import { MockYukassaClient } from "../src/lib/yukassa/mock-client.js";
import { BillingService } from "../src/services/billing.js";
import { PledgeService } from "../src/services/pledges.js";
import { englishLessons, pledges, subscriptions, users } from "../src/db/schema/index.js";
import { seedDatabase } from "../src/services/seed.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Admin API", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];
  let db: Awaited<ReturnType<typeof buildApp>>["app"]["db"];
  let yukassa: MockYukassaClient;
  let webPush: MockWebPushClient;
  let billingService: BillingService;

  beforeAll(async () => {
    await ensureMigrated(env);
    yukassa = new MockYukassaClient();
    webPush = new MockWebPushClient();
    const built = await buildApp({ env, yukassaClient: yukassa, webPushClient: webPush });
    app = built.app;
    db = built.app.db;
    billingService = new BillingService(db, yukassa, new PledgeService(db, yukassa));
    await app.ready();
  });

  beforeEach(async () => {
    webPush.clear();
    await truncateAuthTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAdmin(email = "admin@example.com") {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Admin User",
        age: 30,
        gender: "male",
      },
    });
    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));
    await db.update(users).set({ role: "admin" }).where(eq(users.id, auth.user.id));
    return {
      auth,
      headers: { authorization: `Bearer ${auth.access_token}` },
      userId: auth.user.id,
    };
  }

  async function createRegularUser(email = "user@example.com") {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Regular User",
        age: 25,
        gender: "female",
      },
    });
    const auth = authResponseSchema.parse(JSON.parse(registerResponse.body));
    return {
      auth,
      headers: { authorization: `Bearer ${auth.access_token}` },
      userId: auth.user.id,
    };
  }

  it("rejects non-admin users with 403", async () => {
    const { headers } = await createRegularUser();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it("lists users and returns user detail", async () => {
    const admin = await createAdmin();
    await createRegularUser("listed@example.com");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: admin.headers,
    });

    expect(listResponse.statusCode).toBe(200);
    const list = adminUsersListResponseSchema.parse(JSON.parse(listResponse.body));
    expect(list.items.length).toBeGreaterThanOrEqual(2);

    const regular = list.items.find((item) => item.email === "listed@example.com");
    expect(regular).toBeTruthy();

    const detailResponse = await app.inject({
      method: "GET",
      url: `/api/v1/admin/users/${regular!.id}`,
      headers: admin.headers,
    });

    expect(detailResponse.statusCode).toBe(200);
    const detail = adminUserDetailSchema.parse(JSON.parse(detailResponse.body));
    expect(detail.user.email).toBe("listed@example.com");
    expect(detail.subscription).toBeNull();
  });

  it("manually closes an active pledge", async () => {
    const admin = await createAdmin();
    const user = await createRegularUser("pledge-user@example.com");

    await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: user.headers,
      payload: {
        weight_kg: 70,
        height_cm: 170,
        free_time_min: 60,
        wake_time: "07:00",
        sleep_time: "23:00",
      },
    });

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers: user.headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    const createPledgeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/pledges",
      headers: user.headers,
      payload: { habit_id: habit.id, charity_fund: "children" },
    });
    const payment = createPledgePaymentResponseSchema.parse(JSON.parse(createPledgeResponse.body));
    yukassa.succeedPayment(payment.payment_id);
    await billingService.handleWebhook(
      JSON.stringify(yukassa.buildWebhookEvent(payment.payment_id, "payment.succeeded")),
      undefined,
    );

    const [activePledge] = await db.select().from(pledges).where(eq(pledges.userId, user.userId));
    expect(activePledge?.status).toBe("active");

    const closeResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/pledges/${activePledge!.id}`,
      headers: admin.headers,
      payload: {
        status: "failed",
        admin_comment: "Force majeure test closure",
      },
    });

    expect(closeResponse.statusCode).toBe(200);
    const closed = pledgeResponseSchema.parse(JSON.parse(closeResponse.body));
    expect(closed.status).toBe("failed");
  });

  it("CRUDs english lessons", async () => {
    const admin = await createAdmin();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/english/lessons",
      headers: admin.headers,
      payload: {
        day_number: 1,
        title: "Admin lesson",
        video_url: "https://example.com/admin-lesson",
        duration_sec: 420,
        description: "Created by admin",
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = englishLessonSchema.parse(JSON.parse(createResponse.body));
    expect(created.title).toBe("Admin lesson");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/english/lessons",
      headers: admin.headers,
    });
    const list = adminEnglishLessonsResponseSchema.parse(JSON.parse(listResponse.body));
    expect(list.items.some((item) => item.id === created.id)).toBe(true);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/english/lessons/${created.id}`,
      headers: admin.headers,
      payload: { title: "Updated lesson" },
    });
    const updated = englishLessonSchema.parse(JSON.parse(patchResponse.body));
    expect(updated.title).toBe("Updated lesson");
    expect(updated.day_number).toBe(1);
    expect(updated.duration_sec).toBe(420);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/english/lessons/${created.id}`,
      headers: admin.headers,
    });
    expect(deleteResponse.statusCode).toBe(204);

    const remaining = await db.select().from(englishLessons).where(eq(englishLessons.id, created.id));
    expect(remaining).toHaveLength(0);
  });

  it("broadcasts push to subscribed users", async () => {
    const admin = await createAdmin();
    const user = await createRegularUser("broadcast@example.com");

    await app.inject({
      method: "POST",
      url: "/api/v1/push/subscribe",
      headers: user.headers,
      payload: {
        endpoint: "https://push.example.com/broadcast",
        keys: { p256dh: "key", auth: "auth" },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/push/broadcast",
      headers: admin.headers,
      payload: {
        text: "Admin broadcast message",
        filter: "all",
      },
    });

    expect(response.statusCode).toBe(200);
    const result = adminPushBroadcastResponseSchema.parse(JSON.parse(response.body));
    expect(result.targeted_users).toBeGreaterThanOrEqual(2);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(webPush.sent.length).toBeGreaterThanOrEqual(1);
  });

  it("filters broadcast recipients by subscription state", async () => {
    const admin = await createAdmin();
    const trialUser = await createRegularUser("trial-filter@example.com");
    const expiredUser = await createRegularUser("expired-filter@example.com");

    await db
      .update(users)
      .set({ trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .where(eq(users.id, expiredUser.userId));

    await db.insert(subscriptions).values({
      userId: expiredUser.userId,
      plan: "monthly",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    for (const account of [trialUser, expiredUser]) {
      await app.inject({
        method: "POST",
        url: "/api/v1/push/subscribe",
        headers: account.headers,
        payload: {
          endpoint: `https://push.example.com/${account.userId}`,
          keys: { p256dh: "key", auth: "auth" },
        },
      });
    }

    const trialResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/push/broadcast",
      headers: admin.headers,
      payload: {
        text: "Trial only",
        filter: "trial",
      },
    });
    const trialResult = adminPushBroadcastResponseSchema.parse(JSON.parse(trialResponse.body));
    expect(trialResult.targeted_users).toBeGreaterThanOrEqual(1);

    webPush.clear();

    const subscribedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/push/broadcast",
      headers: admin.headers,
      payload: {
        text: "Subscribers only",
        filter: "subscribed",
      },
    });
    const subscribedResult = adminPushBroadcastResponseSchema.parse(JSON.parse(subscribedResponse.body));
    expect(subscribedResult.targeted_users).toBe(1);
    expect(subscribedResult.sent).toBe(1);
  });

  it("seed script is idempotent", async () => {
    const first = await seedDatabase(db);
    expect(first.users_created).toBe(3);
    expect(first.lessons_created).toBe(ENGLISH_LESSON_COUNT);

    const second = await seedDatabase(db);
    expect(second.users_created).toBe(0);
    expect(second.lessons_created).toBe(0);
  });
});
