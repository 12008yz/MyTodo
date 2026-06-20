import { randomUUID } from "node:crypto";
import { addDays, evaluatePledgePeriod, getUserLocalDate } from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  PLEDGE_AMOUNT,
  PLEDGE_BADGE_STEEL_CHARACTER,
  PLEDGE_PERIOD_DAYS,
  type AdminClosePledgeRequest,
  type CreatePledgeRequest,
  type PledgeCharityFund,
  type PledgeResponse,
} from "@mytodo/shared";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Database, DbExecutor } from "../db/index.js";
import {
  checkins,
  dailyStats,
  habits,
  pledges,
  userBadges,
  users,
  type Pledge,
} from "../db/schema/index.js";
import type { YukassaClient } from "../lib/yukassa/types.js";
import { captureException } from "../lib/sentry.js";

function toPledgeResponse(row: Pledge): PledgeResponse {
  return {
    id: row.id,
    habit_id: row.habitId,
    amount_rub: row.amountRub,
    status: row.status as PledgeResponse["status"],
    charity_fund: row.charityFund as PledgeCharityFund,
    started_at: row.startedAt,
    ended_at: row.endedAt,
    created_at: row.createdAt.toISOString(),
  };
}

function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export class PledgeService {
  constructor(
    private readonly db: Database,
    private readonly yukassa: YukassaClient,
  ) {}

  async listByUser(userId: string): Promise<PledgeResponse[]> {
    const rows = await this.db
      .select()
      .from(pledges)
      .where(eq(pledges.userId, userId))
      .orderBy(desc(pledges.createdAt));

    return rows.map(toPledgeResponse);
  }

  async createPayment(userId: string, input: CreatePledgeRequest) {
    await this.assertCanCreatePledge(userId, input.habit_id);

    const payment = await this.yukassa.createPayment({
      userId,
      plan: "monthly",
      amountRub: PLEDGE_AMOUNT,
      description: "Залог «Новая глава» — 30 дней",
      savePaymentMethod: false,
      idempotenceKey: randomUUID(),
      extraMetadata: {
        purpose: "pledge",
        habit_id: input.habit_id,
        charity_fund: input.charity_fund,
      },
    });

    return {
      payment_id: payment.id,
      confirmation_url: payment.confirmationUrl!,
      amount_rub: PLEDGE_AMOUNT,
      habit_id: input.habit_id,
      charity_fund: input.charity_fund,
    };
  }

  async activateFromPayment(payment: {
    id: string;
    metadata: Record<string, string>;
  }): Promise<void> {
    const userId = payment.metadata.user_id;
    const habitId = payment.metadata.habit_id;
    const charityFund = payment.metadata.charity_fund as PledgeCharityFund | undefined;

    if (!userId || !habitId || !charityFund) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Pledge payment metadata is incomplete",
      );
    }

    await this.assertCanCreatePledge(userId, habitId);

    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "User not found");
    }

    const startedAt = getUserLocalDate(new Date(), user.timezone);

    await this.db.insert(pledges).values({
      userId,
      habitId,
      amountRub: PLEDGE_AMOUNT,
      status: "active",
      charityFund,
      startedAt,
      yukassaPaymentId: payment.id,
    });
  }

  async listActiveHabitIds(userId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ habitId: pledges.habitId })
      .from(pledges)
      .where(and(eq(pledges.userId, userId), eq(pledges.status, "active")));

    return new Set(rows.map((row) => row.habitId));
  }

  async assertNoActivePledge(habitId: string): Promise<void> {
    const [active] = await this.db
      .select({ id: pledges.id })
      .from(pledges)
      .where(and(eq(pledges.habitId, habitId), eq(pledges.status, "active")))
      .limit(1);

    if (active) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Skip is not allowed while a pledge is active on this habit",
      );
    }
  }

  async failActivePledgeForHabit(habitId: string, executor: DbExecutor = this.db): Promise<void> {
    const [pledge] = await executor
      .select()
      .from(pledges)
      .where(and(eq(pledges.habitId, habitId), eq(pledges.status, "active")))
      .limit(1);

    if (!pledge) {
      return;
    }

    const [user] = await executor
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, pledge.userId))
      .limit(1);

    const endedAt = user
      ? getUserLocalDate(new Date(), user.timezone)
      : pledge.startedAt;

    await executor
      .update(pledges)
      .set({
        status: "failed",
        endedAt,
      })
      .where(eq(pledges.id, pledge.id));
  }

  async processExpiredPledges(now: Date = new Date()): Promise<number> {
    const rows = await this.db.select().from(pledges).where(eq(pledges.status, "active"));

    let processed = 0;

    for (const pledge of rows) {
      const [user] = await this.db
        .select({ timezone: users.timezone })
        .from(users)
        .where(eq(users.id, pledge.userId))
        .limit(1);

      if (!user) {
        continue;
      }

      const today = getUserLocalDate(now, user.timezone);
      const periodEndExclusive = addDays(pledge.startedAt, PLEDGE_PERIOD_DAYS);
      if (today < periodEndExclusive) {
        continue;
      }

      await this.completePledge(pledge, now);
      processed += 1;
    }

    return processed;
  }

  private async completePledge(pledge: Pledge, now: Date): Promise<void> {
    const periodEnd = addDays(pledge.startedAt, PLEDGE_PERIOD_DAYS - 1);
    const records = await this.db
      .select({ date: dailyStats.date, status: dailyStats.status })
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.habitId, pledge.habitId),
          gte(dailyStats.date, pledge.startedAt),
          lte(dailyStats.date, periodEnd),
        ),
      );

    const outcome = evaluatePledgePeriod(
      records.map((row) => ({
        date: row.date,
        status: row.status as "success" | "fail" | "skipped",
      })),
      pledge.startedAt,
    );

    if (outcome === "failed") {
      await this.db
        .update(pledges)
        .set({ status: "failed", endedAt: periodEnd })
        .where(eq(pledges.id, pledge.id));
      return;
    }

    let refundError = false;
    if (pledge.yukassaPaymentId) {
      try {
        await this.yukassa.createRefund(pledge.yukassaPaymentId, pledge.amountRub, randomUUID());
      } catch (error) {
        refundError = true;
        captureException(error);
      }
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(pledges)
        .set({
          status: refundError ? "failed" : "success",
          endedAt: periodEnd,
          refundError,
        })
        .where(eq(pledges.id, pledge.id));

      if (!refundError) {
        await this.awardSteelCharacterBadge(tx, pledge.userId);
      }
    });
  }

  async adminClosePledge(pledgeId: string, input: AdminClosePledgeRequest): Promise<PledgeResponse> {
    const [pledge] = await this.db.select().from(pledges).where(eq(pledges.id, pledgeId)).limit(1);

    if (!pledge) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Pledge not found");
    }

    if (pledge.status !== "active") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Only active pledges can be closed manually",
      );
    }

    const [user] = await this.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, pledge.userId))
      .limit(1);

    const endedAt = user
      ? getUserLocalDate(new Date(), user.timezone)
      : pledge.startedAt;

    if (input.status === "failed") {
      const [updated] = await this.db
        .update(pledges)
        .set({
          status: "failed",
          endedAt,
          adminComment: input.admin_comment,
        })
        .where(eq(pledges.id, pledgeId))
        .returning();

      return toPledgeResponse(updated!);
    }

    let refundError = false;
    if (pledge.yukassaPaymentId) {
      try {
        await this.yukassa.createRefund(pledge.yukassaPaymentId, pledge.amountRub, randomUUID());
      } catch (error) {
        refundError = true;
        captureException(error);
      }
    }

    const [updated] = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(pledges)
        .set({
          status: refundError ? "failed" : "success",
          endedAt,
          adminComment: input.admin_comment,
          refundError,
        })
        .where(eq(pledges.id, pledgeId))
        .returning();

      if (row && !refundError) {
        await this.awardSteelCharacterBadge(tx, pledge.userId);
      }

      return [row];
    });

    return toPledgeResponse(updated!);
  }

  async failAllActiveForUser(userId: string, executor: DbExecutor = this.db): Promise<void> {
    const active = await executor
      .select()
      .from(pledges)
      .where(and(eq(pledges.userId, userId), eq(pledges.status, "active")));

    if (active.length === 0) {
      return;
    }

    const [user] = await executor
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const endedAt = user
      ? getUserLocalDate(new Date(), user.timezone)
      : active[0]!.startedAt;

    for (const pledge of active) {
      await executor
        .update(pledges)
        .set({ status: "failed", endedAt })
        .where(eq(pledges.id, pledge.id));
    }
  }

  private async awardSteelCharacterBadge(
    executor: DbExecutor,
    userId: string,
  ): Promise<void> {
    const [existing] = await executor
      .select({ id: userBadges.id })
      .from(userBadges)
      .where(
        and(eq(userBadges.userId, userId), eq(userBadges.badgeType, PLEDGE_BADGE_STEEL_CHARACTER)),
      )
      .limit(1);

    if (existing) {
      return;
    }

    await executor.insert(userBadges).values({
      userId,
      badgeType: PLEDGE_BADGE_STEEL_CHARACTER,
    });
  }

  private async assertCanCreatePledge(userId: string, habitId: string): Promise<void> {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId), eq(habits.isActive, true)))
      .limit(1);

    if (!habit) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Habit not found");
    }

    const [user] = await this.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user) {
      const today = getUserLocalDate(new Date(), user.timezone);
      const [skippedToday] = await this.db
        .select({ id: checkins.id })
        .from(checkins)
        .where(
          and(
            eq(checkins.habitId, habitId),
            eq(checkins.date, today),
            eq(checkins.status, "skipped"),
          ),
        )
        .limit(1);

      if (skippedToday) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Cannot start a pledge on a habit with a skip today",
        );
      }
    }

    const [active] = await this.db
      .select({ id: pledges.id })
      .from(pledges)
      .where(and(eq(pledges.userId, userId), eq(pledges.status, "active")))
      .limit(1);

    if (active) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        "User already has an active pledge",
      );
    }

    const [thisMonth] = await this.db
      .select({ id: pledges.id })
      .from(pledges)
      .where(and(eq(pledges.userId, userId), gte(pledges.createdAt, monthStartUtc(new Date()))))
      .limit(1);

    if (thisMonth) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Only one pledge per calendar month is allowed",
      );
    }
  }
}
