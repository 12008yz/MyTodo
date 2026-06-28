import { randomUUID } from "node:crypto";
import { hasBillingAccess } from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  PAST_DUE_MAX_RETRIES,
  PAST_DUE_RETRY_DAYS,
  SUBSCRIPTION_PLANS,
  type SubscribeRequest,
  type SubscriptionPlanId,
  type SubscriptionResponse,
} from "@mytodo/shared";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  billingWebhookEvents,
  subscriptions,
  type Subscription,
  type User,
} from "../db/schema/index.js";
import type { YukassaClient, YukassaWebhookEvent } from "../lib/yukassa/types.js";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function computePeriodEnd(
  planId: SubscriptionPlanId,
  from: Date,
  existingPeriodEnd?: Date | null,
): Date {
  const base =
    existingPeriodEnd && existingPeriodEnd > from ? existingPeriodEnd : from;
  return addDays(base, SUBSCRIPTION_PLANS[planId].periodDays);
}

function toSubscriptionResponse(row: Subscription): SubscriptionResponse {
  return {
    id: row.id,
    plan: row.plan as SubscriptionPlanId,
    status: row.status as SubscriptionResponse["status"],
    current_period_end: row.currentPeriodEnd.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

import type { PledgeService } from "./pledges.js";

export class BillingService {
  constructor(
    private readonly db: Database,
    private readonly yukassa: YukassaClient,
    private readonly pledgeService?: PledgeService,
  ) {}

  async getAccessSubscription(userId: string): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return row ?? null;
  }

  async userHasAccess(user: User, now: Date = new Date()): Promise<boolean> {
    const subscription = await this.getAccessSubscription(user.id);
    return hasBillingAccess({
      now,
      trialEndsAt: user.trialEndsAt,
      subscription: subscription
        ? { status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd }
        : null,
    });
  }

  async subscribe(userId: string, input: SubscribeRequest) {
    const plan = SUBSCRIPTION_PLANS[input.plan];
    const active = await this.getAccessSubscription(userId);
    const now = new Date();

    if (
      active?.status === "past_due" ||
      (active?.status === "active" && active.currentPeriodEnd > now)
    ) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        "Active subscription already exists",
      );
    }

    const payment = await this.yukassa.createPayment({
      userId,
      plan: input.plan,
      amountRub: plan.priceRub,
      description: `Подписка «Новая глава» — ${input.plan}`,
      savePaymentMethod: plan.recurring,
      idempotenceKey: randomUUID(),
    });

    return {
      payment_id: payment.id,
      confirmation_url: payment.confirmationUrl!,
      plan: input.plan,
      amount_rub: plan.priceRub,
    };
  }

  async cancel(userId: string): Promise<SubscriptionResponse> {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!subscription) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "No active subscription");
    }

    if (subscription.plan !== "monthly") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Only monthly subscriptions can be canceled",
      );
    }

    const [updated] = await this.db
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    return toSubscriptionResponse(updated!);
  }

  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    if (!this.yukassa.verifyWebhookSignature(rawBody, signature)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, "Invalid webhook signature");
    }

    const event = JSON.parse(rawBody) as YukassaWebhookEvent;
    const paymentId = event.object.id;
    const eventType = event.event;

    const [claimed] = await this.db
      .insert(billingWebhookEvents)
      .values({
        yukassaPaymentId: paymentId,
        eventType,
      })
      .onConflictDoNothing()
      .returning();

    if (!claimed) {
      return;
    }

    const payment = await this.yukassa.getPayment(paymentId);

    if (eventType === "payment.succeeded" && payment.paid) {
      if (payment.metadata.purpose === "pledge") {
        await this.pledgeService?.activateFromPayment(payment);
      } else {
        await this.activateSubscription(payment);
      }
    } else if (eventType === "payment.canceled") {
      await this.markPastDueFromPayment(payment);
    }
  }

  /** Expire fixed-term plans and attempt monthly renewal when the period ends. */
  async processEndedSubscriptions(now: Date = new Date()): Promise<number> {
    const ended = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.status, "active"), lte(subscriptions.currentPeriodEnd, now)));

    let processed = 0;

    for (const subscription of ended) {
      if (subscription.plan !== "monthly") {
        await this.db
          .update(subscriptions)
          .set({ status: "expired" })
          .where(eq(subscriptions.id, subscription.id));
        processed += 1;
        continue;
      }

      const renewed = await this.attemptMonthlyCharge(subscription, now);
      if (!renewed) {
        await this.db
          .update(subscriptions)
          .set({
            status: "past_due",
            lastPaymentFailedAt: now,
            pastDueRetryCount: 0,
          })
          .where(eq(subscriptions.id, subscription.id));
      }

      processed += 1;
    }

    return processed;
  }

  async processPastDueRetries(now: Date = new Date()): Promise<number> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.status, "past_due"), eq(subscriptions.plan, "monthly")));

    let processed = 0;

    for (const subscription of rows) {
      if (subscription.pastDueRetryCount >= PAST_DUE_MAX_RETRIES) {
        await this.db
          .update(subscriptions)
          .set({ status: "expired" })
          .where(eq(subscriptions.id, subscription.id));
        processed += 1;
        continue;
      }

      if (!subscription.lastPaymentFailedAt) {
        continue;
      }

      const retryAt = addDays(subscription.lastPaymentFailedAt, PAST_DUE_RETRY_DAYS);
      if (now < retryAt) {
        continue;
      }

      if (!subscription.yukassaPaymentMethodId) {
        await this.db
          .update(subscriptions)
          .set({
            status: "expired",
            pastDueRetryCount: PAST_DUE_MAX_RETRIES,
          })
          .where(eq(subscriptions.id, subscription.id));
        processed += 1;
        continue;
      }

      try {
        const renewed = await this.attemptMonthlyCharge(subscription, now);
        if (renewed) {
          processed += 1;
          continue;
        }
      } catch {
        // fall through to retry counter
      }

      await this.incrementPastDueRetry(subscription.id, subscription.pastDueRetryCount, now);
      processed += 1;
    }

    return processed;
  }

  private async incrementPastDueRetry(
    subscriptionId: string,
    currentCount: number,
    now: Date,
  ): Promise<void> {
    const nextCount = currentCount + 1;
    await this.db
      .update(subscriptions)
      .set({
        pastDueRetryCount: nextCount,
        lastPaymentFailedAt: now,
        status: nextCount >= PAST_DUE_MAX_RETRIES ? "expired" : "past_due",
      })
      .where(eq(subscriptions.id, subscriptionId));
  }

  private async activateSubscription(payment: {
    metadata: Record<string, string>;
    paymentMethodId: string | null;
  }): Promise<void> {
    const userId = payment.metadata.user_id;
    const planId = payment.metadata.plan as SubscriptionPlanId | undefined;

    if (!userId || !planId || !(planId in SUBSCRIPTION_PLANS)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Payment metadata is missing subscription details",
      );
    }

    const now = new Date();

    const [existing] = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(subscriptions.status, ["active", "past_due", "canceled"]),
        ),
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (existing && existing.status === "active") {
      const periodEnd = computePeriodEnd(planId, now, existing.currentPeriodEnd);
      await this.db
        .update(subscriptions)
        .set({
          plan: planId,
          currentPeriodEnd: periodEnd,
          yukassaPaymentMethodId: payment.paymentMethodId ?? existing.yukassaPaymentMethodId,
          pastDueRetryCount: 0,
          lastPaymentFailedAt: null,
        })
        .where(eq(subscriptions.id, existing.id));
      return;
    }

    if (existing && (existing.status === "past_due" || existing.status === "canceled")) {
      const periodEnd = computePeriodEnd(planId, now, existing.currentPeriodEnd);
      await this.db
        .update(subscriptions)
        .set({
          plan: planId,
          status: "active",
          currentPeriodEnd: periodEnd,
          yukassaPaymentMethodId: payment.paymentMethodId ?? existing.yukassaPaymentMethodId,
          pastDueRetryCount: 0,
          lastPaymentFailedAt: null,
        })
        .where(eq(subscriptions.id, existing.id));
      return;
    }

    await this.db.insert(subscriptions).values({
      userId,
      plan: planId,
      status: "active",
      currentPeriodEnd: computePeriodEnd(planId, now),
      yukassaPaymentMethodId: payment.paymentMethodId,
    });
  }

  private async attemptMonthlyCharge(
    subscription: Subscription,
    now: Date,
  ): Promise<boolean> {
    if (!subscription.yukassaPaymentMethodId) {
      return false;
    }

    const planId = subscription.plan as SubscriptionPlanId;
    const plan = SUBSCRIPTION_PLANS[planId];
    const payment = await this.yukassa.createRecurringPayment({
      userId: subscription.userId,
      plan: planId,
      amountRub: plan.priceRub,
      paymentMethodId: subscription.yukassaPaymentMethodId,
      description: `Продление подписки «Новая глава»`,
      idempotenceKey: randomUUID(),
    });

    if (!payment.paid) {
      return false;
    }

    await this.db
      .update(subscriptions)
      .set({
        status: "active",
        currentPeriodEnd: computePeriodEnd(planId, now, subscription.currentPeriodEnd),
        pastDueRetryCount: 0,
        lastPaymentFailedAt: null,
      })
      .where(eq(subscriptions.id, subscription.id));

    return true;
  }

  private async markPastDueFromPayment(payment: { metadata: Record<string, string> }): Promise<void> {
    const userId = payment.metadata.user_id;
    if (!userId) {
      return;
    }

    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!subscription || subscription.plan !== "monthly") {
      return;
    }

    await this.db
      .update(subscriptions)
      .set({
        status: "past_due",
        lastPaymentFailedAt: new Date(),
        pastDueRetryCount: 0,
      })
      .where(eq(subscriptions.id, subscription.id));
  }
}
