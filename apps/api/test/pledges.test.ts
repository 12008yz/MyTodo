import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { addDays, getUserLocalDate } from "@mytodo/domain";
import {
  authResponseSchema,
  createPledgePaymentResponseSchema,
  habitResponseSchema,
  pledgeResponseSchema,
} from "@mytodo/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { MockYukassaClient } from "../src/lib/yukassa/mock-client.js";
import { BillingService } from "../src/services/billing.js";
import { CheckinService } from "../src/services/checkins.js";
import { DayCloseService } from "../src/services/day-close.js";
import { DoomScrollService } from "../src/services/doom-scroll.js";
import { PledgeService } from "../src/services/pledges.js";
import { dailyStats, pledges, userBadges, users } from "../src/db/schema/index.js";
import { ensureMigrated, truncateAuthTables } from "./helpers/db.js";

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
});

describe("Pledges", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];
  let db: Awaited<ReturnType<typeof buildApp>>["app"]["db"];
  let yukassa: MockYukassaClient;
  let pledgeService: PledgeService;
  let billingService: BillingService;
  let dayCloseService: DayCloseService;

  beforeAll(async () => {
    await ensureMigrated(env);
    yukassa = new MockYukassaClient();
    const built = await buildApp({ env, yukassaClient: yukassa });
    app = built.app;
    db = built.app.db;
    pledgeService = new PledgeService(db, yukassa);
    billingService = new BillingService(db, yukassa, pledgeService);
    const checkinService = new CheckinService(db);
    const doomScrollService = new DoomScrollService(db, checkinService);
    dayCloseService = new DayCloseService(db, doomScrollService, pledgeService);
    await app.ready();
  });

  beforeEach(async () => {
    await truncateAuthTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAndOnboard(email = "pledge@example.com") {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password: "password123",
        name: "Pledge User",
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
      },
    });

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "books", baseline_value: 5 },
    });
    const habit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    return { auth, headers, habit };
  }

  async function activatePledge(
    headers: Record<string, string>,
    habitId: string,
    charityFund: "oncology" | "children" | "animals" = "children",
  ) {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/pledges",
      headers,
      payload: { habit_id: habitId, charity_fund: charityFund },
    });
    const payment = createPledgePaymentResponseSchema.parse(JSON.parse(createResponse.body));
    yukassa.succeedPayment(payment.payment_id);
    await billingService.handleWebhook(
      JSON.stringify(yukassa.buildWebhookEvent(payment.payment_id, "payment.succeeded")),
      undefined,
    );
    return payment;
  }

  it("creates pledge payment and activates via webhook", async () => {
    const { headers, habit } = await registerAndOnboard();
    await activatePledge(headers, habit.id);

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/pledges",
      headers,
    });
    const list = JSON.parse(listResponse.body).map((item: unknown) =>
      pledgeResponseSchema.parse(item),
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe("active");
    expect(list[0]?.habit_id).toBe(habit.id);
  });

  it("fails pledge immediately on dark habit fail checkin", async () => {
    const { headers } = await registerAndOnboard("fail-pledge@example.com");

    const habitResponse = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "smoking", baseline_value: 20 },
    });
    const smokingHabit = habitResponseSchema.parse(JSON.parse(habitResponse.body));

    await activatePledge(headers, smokingHabit.id);

    await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: smokingHabit.id, value: 25 },
    });

    const [pledge] = await db.select().from(pledges);
    expect(pledge?.status).toBe("failed");
  });

  it("fails light habit pledge when day closes without meeting the goal", async () => {
    const email = "books-pledge-close@example.com";
    const { headers, habit } = await registerAndOnboard(email);
    await activatePledge(headers, habit.id);

    const [user] = await db.select().from(users).where(eq(users.email, email));
    const closeDate = getUserLocalDate(new Date(), user!.timezone);

    await dayCloseService.closeDayForUser(user!, closeDate);

    const [pledge] = await db.select().from(pledges);
    expect(pledge?.status).toBe("failed");
  });

  it("rejects skip when pledge is active", async () => {
    const { headers, habit } = await registerAndOnboard("skip-pledge@example.com");
    await activatePledge(headers, habit.id);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/checkins",
      headers,
      payload: { habit_id: habit.id, status: "skipped" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects second pledge in the same month", async () => {
    const email = "second-pledge@example.com";
    const { headers, habit } = await registerAndOnboard(email);
    await activatePledge(headers, habit.id);

    const [user] = await db.select().from(users).where(eq(users.email, email));
    const closeDate = getUserLocalDate(new Date(), user!.timezone);
    await dayCloseService.closeDayForUser(user!, closeDate);

    const habit2Response = await app.inject({
      method: "POST",
      url: "/api/v1/habits",
      headers,
      payload: { template_id: "running", baseline_value: 10 },
    });
    const habit2 = habitResponseSchema.parse(JSON.parse(habit2Response.body));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/pledges",
      headers,
      payload: { habit_id: habit2.id, charity_fund: "animals" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("completes pledge with success after 30 successful days", async () => {
    const { headers, habit } = await registerAndOnboard("success-pledge@example.com");
    await activatePledge(headers, habit.id);

    const [pledge] = await db.select().from(pledges);
    const start = pledge!.startedAt;

    for (let day = 0; day < 30; day += 1) {
      const date = addDays(start, day);
      await db.insert(dailyStats).values({
        habitId: habit.id,
        date,
        status: "success",
        value: "10",
        minutesTotal: 0,
      });
    }

    await pledgeService.processExpiredPledges(new Date(`${addDays(start, 30)}T12:00:00Z`));

    const [updated] = await db.select().from(pledges).where(eq(pledges.id, pledge!.id));
    const badges = await db.select().from(userBadges);

    expect(updated?.status).toBe("success");
    expect(badges).toHaveLength(1);
    expect(badges[0]?.badgeType).toBe("steel_character");
  });

  it("fails pledge at expiry when a day has fail status", async () => {
    const { headers, habit } = await registerAndOnboard("expiry-fail@example.com");
    await activatePledge(headers, habit.id);

    const [pledge] = await db.select().from(pledges);
    const start = pledge!.startedAt;

    for (let day = 0; day < 30; day += 1) {
      await db.insert(dailyStats).values({
        habitId: habit.id,
        date: addDays(start, day),
        status: day === 15 ? "fail" : "success",
        value: "10",
        minutesTotal: 0,
      });
    }

    await pledgeService.processExpiredPledges(new Date(`${addDays(start, 30)}T12:00:00Z`));

    const [updated] = await db.select().from(pledges).where(eq(pledges.id, pledge!.id));
    expect(updated?.status).toBe("failed");
  });
});
