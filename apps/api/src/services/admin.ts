import {
  hasBillingAccess,
  type SubscriptionAccess,
} from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  type AdminBroadcastFilter,
  type AdminClosePledgeRequest,
  type AdminSubscriptionFilter,
  type AdminUsersQuery,
  type CreateEnglishLessonRequest,
  type PatchEnglishLessonRequest,
} from "@mytodo/shared";
import { asc, desc, eq, ilike, or } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  englishLessons,
  pledges,
  subscriptions,
  users,
  type EnglishLesson,
  type Subscription,
  type User,
} from "../db/schema/index.js";
import { toUserProfile } from "../lib/user-mapper.js";
import type { BillingService } from "./billing.js";
import type { PledgeService } from "./pledges.js";

function toLessonResponse(lesson: EnglishLesson) {
  return {
    id: lesson.id,
    day_number: lesson.dayNumber,
    title: lesson.title,
    video_url: lesson.videoUrl,
    duration_sec: lesson.durationSec,
    description: lesson.description,
  };
}

function toSubscriptionAccess(subscription: Subscription | null): SubscriptionAccess | null {
  if (!subscription) {
    return null;
  }

  return {
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

function hasPaidSubscription(subscription: Subscription | null, now: Date): boolean {
  if (!subscription) {
    return false;
  }

  if (subscription.status === "past_due") {
    return true;
  }

  if (subscription.status === "active" && now < subscription.currentPeriodEnd) {
    return true;
  }

  if (subscription.status === "canceled" && now < subscription.currentPeriodEnd) {
    return true;
  }

  return false;
}

export class AdminService {
  constructor(
    private readonly db: Database,
    private readonly billingService: BillingService,
    private readonly pledgeService: PledgeService,
  ) {}

  async listUsers(query: AdminUsersQuery) {
    const search = query.search?.trim();
    const userRows = await this.db
      .select()
      .from(users)
      .where(
        search
          ? or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`))
          : undefined,
      )
      .orderBy(desc(users.createdAt));

    const subscriptionRows = await this.db
      .select()
      .from(subscriptions)
      .orderBy(desc(subscriptions.createdAt));

    const latestSubscriptionByUser = new Map<string, Subscription>();
    for (const row of subscriptionRows) {
      if (!latestSubscriptionByUser.has(row.userId)) {
        latestSubscriptionByUser.set(row.userId, row);
      }
    }

    const activePledgeUserIds = new Set(
      (
        await this.db
          .select({ userId: pledges.userId })
          .from(pledges)
          .where(eq(pledges.status, "active"))
      ).map((row) => row.userId),
    );

    const now = new Date();

    const items = userRows
      .filter((user) => {
        const subscription = latestSubscriptionByUser.get(user.id) ?? null;

        if (query.subscription && !this.matchesSubscriptionFilter(user, subscription, query.subscription, now)) {
          return false;
        }

        if (query.pledge) {
          const hasActive = activePledgeUserIds.has(user.id);
          if (query.pledge === "active" && !hasActive) {
            return false;
          }
          if (query.pledge === "none" && hasActive) {
            return false;
          }
        }

        return true;
      })
      .map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as "user" | "admin",
        trial_ends_at: user.trialEndsAt.toISOString(),
        subscription_status: latestSubscriptionByUser.get(user.id)?.status ?? null,
        has_active_pledge: activePledgeUserIds.has(user.id),
        created_at: user.createdAt.toISOString(),
      }));

    return { items };
  }

  async getUser(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "User not found");
    }

    const subscription = await this.billingService.getAccessSubscription(userId);
    const userPledges = await this.pledgeService.listByUser(userId);

    return {
      user: toUserProfile(user),
      subscription: subscription
        ? {
            id: subscription.id,
            plan: subscription.plan as "monthly" | "2months" | "3months",
            status: subscription.status as "active" | "canceled" | "expired" | "past_due",
            current_period_end: subscription.currentPeriodEnd.toISOString(),
            created_at: subscription.createdAt.toISOString(),
          }
        : null,
      pledges: userPledges,
    };
  }

  async closePledge(pledgeId: string, input: AdminClosePledgeRequest) {
    return this.pledgeService.adminClosePledge(pledgeId, input);
  }

  async listEnglishLessons() {
    const rows = await this.db.select().from(englishLessons).orderBy(asc(englishLessons.dayNumber));
    return { items: rows.map(toLessonResponse) };
  }

  async createEnglishLesson(input: CreateEnglishLessonRequest) {
    const [existing] = await this.db
      .select({ id: englishLessons.id })
      .from(englishLessons)
      .where(eq(englishLessons.dayNumber, input.day_number))
      .limit(1);

    if (existing) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        "Lesson for this day number already exists",
      );
    }

    const [lesson] = await this.db
      .insert(englishLessons)
      .values({
        dayNumber: input.day_number,
        title: input.title,
        videoUrl: input.video_url,
        durationSec: input.duration_sec,
        description: input.description ?? null,
      })
      .returning();

    return toLessonResponse(lesson!);
  }

  async updateEnglishLesson(lessonId: string, input: PatchEnglishLessonRequest) {
    const [existing] = await this.db
      .select()
      .from(englishLessons)
      .where(eq(englishLessons.id, lessonId))
      .limit(1);

    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Lesson not found");
    }

    if (input.day_number !== undefined && input.day_number !== existing.dayNumber) {
      const [conflict] = await this.db
        .select({ id: englishLessons.id })
        .from(englishLessons)
        .where(eq(englishLessons.dayNumber, input.day_number))
        .limit(1);

      if (conflict && conflict.id !== lessonId) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.CONFLICT,
          "Lesson for this day number already exists",
        );
      }
    }

    const updates: Partial<typeof englishLessons.$inferInsert> = {};
    if (input.day_number !== undefined) updates.dayNumber = input.day_number;
    if (input.title !== undefined) updates.title = input.title;
    if (input.video_url !== undefined) updates.videoUrl = input.video_url;
    if (input.duration_sec !== undefined) updates.durationSec = input.duration_sec;
    if (input.description !== undefined) updates.description = input.description;

    const [lesson] = await this.db
      .update(englishLessons)
      .set(updates)
      .where(eq(englishLessons.id, lessonId))
      .returning();

    return toLessonResponse(lesson!);
  }

  async deleteEnglishLesson(lessonId: string): Promise<void> {
    const [existing] = await this.db
      .select({ id: englishLessons.id })
      .from(englishLessons)
      .where(eq(englishLessons.id, lessonId))
      .limit(1);

    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Lesson not found");
    }

    await this.db.delete(englishLessons).where(eq(englishLessons.id, lessonId));
  }

  async resolveBroadcastUserIds(filter: AdminBroadcastFilter, now: Date = new Date()): Promise<string[]> {
    const rows = await this.db.select().from(users);
    const subscriptionRows = await this.db
      .select()
      .from(subscriptions)
      .orderBy(desc(subscriptions.createdAt));

    const latestSubscriptionByUser = new Map<string, Subscription>();
    for (const row of subscriptionRows) {
      if (!latestSubscriptionByUser.has(row.userId)) {
        latestSubscriptionByUser.set(row.userId, row);
      }
    }

    return rows
      .filter((user) =>
        this.matchesBroadcastFilter(
          user,
          latestSubscriptionByUser.get(user.id) ?? null,
          filter,
          now,
        ),
      )
      .map((user) => user.id);
  }

  private matchesSubscriptionFilter(
    user: User,
    subscription: Subscription | null,
    filter: AdminSubscriptionFilter,
    now: Date,
  ): boolean {
    const onTrial = now < user.trialEndsAt;
    const subscriptionAccess = toSubscriptionAccess(subscription);

    switch (filter) {
      case "trial":
        return onTrial && !hasPaidSubscription(subscription, now);
      case "active":
        return subscription?.status === "active" && now < subscription.currentPeriodEnd;
      case "past_due":
        return subscription?.status === "past_due";
      case "expired":
        return (
          !onTrial &&
          !hasBillingAccess({
            now,
            trialEndsAt: user.trialEndsAt,
            subscription: subscriptionAccess,
          })
        );
      case "none":
        return !subscription;
      default:
        return true;
    }
  }

  private matchesBroadcastFilter(
    user: User,
    subscription: Subscription | null,
    filter: AdminBroadcastFilter,
    now: Date,
  ): boolean {
    const onTrial = now < user.trialEndsAt;
    const paid = hasPaidSubscription(subscription, now);

    switch (filter) {
      case "all":
        return true;
      case "subscribed":
        return paid;
      case "trial":
        return onTrial && !paid;
      case "no_subscription":
        return !onTrial && !paid;
      default:
        return false;
    }
  }
}
