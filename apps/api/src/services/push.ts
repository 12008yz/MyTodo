import { and, asc, eq, isNotNull } from "drizzle-orm";
import {
  effectiveHarshnessLevel,
  findDueCheerSlot,
  findDueScheduleEvents,
  getUserLocalDate,
  isSilenceModeActive,
} from "@mytodo/domain";
import {
  ApiError,
  buildDefaultPushTemplates,
  ERROR_CODES,
  HTTP_STATUS,
  type PushEventType,
  type PushSubscribeRequest,
} from "@mytodo/shared";
import type { DbExecutor } from "../db/index.js";
import {
  checkins,
  habits,
  notificationTemplates,
  pushDeliveryLog,
  pushSubscriptions,
  users,
  type Habit,
  type User,
} from "../db/schema/index.js";
import type { WebPushClient } from "../lib/web-push/types.js";

export type PushLogger = {
  info: (obj: Record<string, unknown>, message?: string) => void;
  error: (obj: Record<string, unknown>, message?: string) => void;
};

type SendEventOptions = {
  slot?: number;
  skipSilenceCheck?: boolean;
  skipDedup?: boolean;
  harshnessLevel?: number;
};

export class PushService {
  constructor(
    private readonly db: DbExecutor,
    private readonly webPush: WebPushClient,
    private readonly logger?: PushLogger,
  ) {}

  async subscribe(userId: string, input: PushSubscribeRequest) {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, input.endpoint));

    const [row] = await this.db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      })
      .returning();

    if (!row) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to save push subscription",
      );
    }

    return { id: row.id, endpoint: row.endpoint };
  }

  async unsubscribe(userId: string, endpoint?: string): Promise<void> {
    if (endpoint) {
      await this.db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
      return;
    }

    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async sendTest(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return this.sendEvent(user, "test", { skipDedup: true });
  }

  async broadcast(
    userIds: string[],
    text: string,
  ): Promise<{ targeted_users: number; sent: number; failed: number }> {
    const uniqueUserIds = [...new Set(userIds)];
    let sent = 0;
    let failed = 0;

    for (const userId of uniqueUserIds) {
      const subscriptions = await this.db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      if (subscriptions.length === 0) {
        continue;
      }

      const payload = JSON.stringify({
        title: "Новая глава",
        body: text,
        event_type: "broadcast",
      });

      let deliveredToUser = false;

      for (const subscription of subscriptions) {
        try {
          await this.webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
          );
          this.logger?.info(
            {
              event: "push_sent",
              user_id: userId,
              event_type: "broadcast",
            },
            "broadcast push sent",
          );
          deliveredToUser = true;
        } catch (error) {
          this.logger?.error(
            {
              event: "push_failed",
              user_id: userId,
              event_type: "broadcast",
              error: error instanceof Error ? error.message : String(error),
            },
            "broadcast push failed",
          );
        }
      }

      if (deliveredToUser) {
        sent += 1;
      } else {
        failed += 1;
      }
    }

    return {
      targeted_users: uniqueUserIds.length,
      sent,
      failed,
    };
  }

  async sendEvent(user: User, eventType: PushEventType, options: SendEventOptions = {}): Promise<boolean> {
    const now = new Date();

    if (!options.skipSilenceCheck && isSilenceModeActive(user.silenceModeUntil, now)) {
      return false;
    }

    const localDate = getUserLocalDate(now, user.timezone);
    const slot = options.slot ?? 0;

    const harshness =
      options.harshnessLevel ??
      effectiveHarshnessLevel(user.harshnessLevel, user.silenceModeUntil, now);
    const message = await this.resolveMessage(eventType, harshness);

    if (!message) {
      return false;
    }

    const subscriptions = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));

    if (subscriptions.length === 0) {
      return false;
    }

    if (!options.skipDedup) {
      const reserved = await this.reserveDelivery(user.id, eventType, localDate, slot);
      if (!reserved) {
        return false;
      }
    }

    const payload = JSON.stringify({
      title: "Новая глава",
      body: message,
      event_type: eventType,
    });

    let sent = false;

    for (const subscription of subscriptions) {
      try {
        await this.webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
        this.logger?.info(
          {
            event: "push_sent",
            user_id: user.id,
            event_type: eventType,
            slot,
          },
          "push sent",
        );
        sent = true;
      } catch (error) {
        this.logger?.error(
          {
            event: "push_failed",
            user_id: user.id,
            event_type: eventType,
            slot,
            error: error instanceof Error ? error.message : String(error),
          },
          "push failed",
        );
      }
    }

    return sent;
  }

  async runScheduledPushes(now: Date = new Date()): Promise<void> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.onboardingCompleted, true), isNotNull(users.wakeTime), isNotNull(users.sleepTime)));

    for (const user of rows) {
      if (!user.wakeTime || !user.sleepTime) {
        continue;
      }

      if (isSilenceModeActive(user.silenceModeUntil, now)) {
        continue;
      }

      const dueEvents = findDueScheduleEvents(now, user.timezone, user.wakeTime, user.sleepTime);
      for (const eventType of dueEvents) {
        await this.sendEvent(user, eventType, { slot: 0 });
      }

      const localDate = getUserLocalDate(now, user.timezone);
      const cheerSlot = findDueCheerSlot(
        now,
        user.timezone,
        user.wakeTime,
        user.sleepTime,
        localDate,
      );

      if (cheerSlot != null && (await this.shouldSendCheer(user, localDate))) {
        await this.sendEvent(user, "smoke_cheer", { slot: cheerSlot });
      }
    }
  }

  async onCheckinInstant(
    user: User,
    habit: Habit,
    status: string,
    previousStatus?: string | null,
  ): Promise<void> {
    if (habit.type === "abstinence" && status === "fail") {
      await this.sendEvent(user, "relapse", {
        skipDedup: true,
        harshnessLevel: habit.harshnessLevel,
      });
      return;
    }

    if (
      habit.side === "light" &&
      habit.type === "target" &&
      status === "success" &&
      previousStatus !== "success"
    ) {
      await this.sendEvent(user, "success", {
        skipDedup: true,
        harshnessLevel: habit.harshnessLevel,
      });
      return;
    }

    if (
      habit.templateId === "social_media" &&
      habit.type === "limit" &&
      status === "fail" &&
      previousStatus !== "fail"
    ) {
      await this.sendEvent(user, "doom_scroll_limit", {
        slot: 0,
        harshnessLevel: habit.harshnessLevel,
      });
    }
  }

  async onDoomScrollStart(user: User, habit: Habit): Promise<void> {
    await this.sendEvent(user, "doom_scroll_start", {
      skipDedup: true,
      harshnessLevel: habit.harshnessLevel,
    });
  }

  async onDoomScrollEnd(user: User, habit: Habit, sessionStartedAt: Date): Promise<boolean> {
    const slot = Math.floor(sessionStartedAt.getTime() / 60_000) % 10_000;
    return this.sendEvent(user, "doom_scroll_end", {
      slot,
      harshnessLevel: habit.harshnessLevel,
    });
  }

  async onDoomScrollLimit(user: User, habit: Habit): Promise<void> {
    await this.sendEvent(user, "doom_scroll_limit", {
      slot: 0,
      harshnessLevel: habit.harshnessLevel,
    });
  }

  private async shouldSendCheer(user: User, localDate: string): Promise<boolean> {
    const smokingHabits = await this.db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.userId, user.id),
          eq(habits.isActive, true),
          eq(habits.templateId, "smoking"),
        ),
      );

    const eligible = smokingHabits.some(
      (habit) => habit.phase === "abstinence" || Number(habit.currentGoal) === 0,
    );

    if (!eligible) {
      return false;
    }

    for (const habit of smokingHabits) {
      const [todayCheckin] = await this.db
        .select()
        .from(checkins)
        .where(and(eq(checkins.habitId, habit.id), eq(checkins.date, localDate)))
        .limit(1);

      if (todayCheckin?.status === "fail") {
        return false;
      }

      if (habit.lastRelapseAt && getUserLocalDate(habit.lastRelapseAt, user.timezone) === localDate) {
        return false;
      }
    }

    return true;
  }

  private async reserveDelivery(
    userId: string,
    eventType: PushEventType,
    localDate: string,
    slot: number,
  ): Promise<boolean> {
    try {
      await this.db.insert(pushDeliveryLog).values({
        userId,
        eventType,
        localDate,
        slot,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async resolveMessage(eventType: PushEventType, harshnessLevel: number): Promise<string | null> {
    const [template] = await this.db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.eventType, eventType),
          eq(notificationTemplates.harshnessLevel, harshnessLevel),
        ),
      )
      .orderBy(asc(notificationTemplates.id))
      .limit(1);

    return template?.message ?? null;
  }

  private async getUser(userId: string): Promise<User> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "User not found");
    }

    return user;
  }
}

export const DEFAULT_PUSH_TEMPLATES = buildDefaultPushTemplates();

export async function seedPushTemplates(db: DbExecutor): Promise<void> {
  const existing = await db.select({ id: notificationTemplates.id }).from(notificationTemplates).limit(1);
  if (existing.length > 0) {
    return;
  }

  await db.insert(notificationTemplates).values(DEFAULT_PUSH_TEMPLATES);
}
