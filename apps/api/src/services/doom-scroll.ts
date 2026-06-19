import { and, eq, gt, lte } from "drizzle-orm";
import { computeNextGoal, getUserLocalDate } from "@mytodo/domain";
import {
  ApiError,
  DOOM_SCROLL_DURATION_MIN,
  ERROR_CODES,
  HTTP_STATUS,
  type DoomScrollSessionResponse,
} from "@mytodo/shared";
import type { DbExecutor } from "../db/index.js";
import { checkins, doomScrollSessions, habits, users, type User } from "../db/schema/index.js";
import { previewStatusFromCheckin, toProgressionHabit } from "../lib/habit-progression.js";
import { computeDoomScrollMinutes, computeRemainingSeconds } from "../lib/session-minutes.js";
import type { CheckinService } from "./checkins.js";
import type { PushService } from "./push.js";
import type { Queue } from "bullmq";
import type { DoomScrollEndJobData } from "../worker/push-queue.js";

type CheckinSnapshot = {
  date: string;
  status: "success" | "fail" | "pending" | "skipped";
  value: number | null;
  current_goal: number;
  preview_next_goal: number;
};

export class DoomScrollService {
  constructor(
    private readonly db: DbExecutor,
    private readonly checkinService: CheckinService,
    private readonly pushService?: PushService,
    private readonly pushQueue?: Queue<DoomScrollEndJobData>,
  ) {}

  async start(user: User, habitId: string): Promise<DoomScrollSessionResponse> {
    const habit = await this.getDoomScrollHabit(user.id, habitId);
    await this.finalizeStaleSessionsForHabit(user, habit.id);

    const active = await this.findActiveSession(habit.id);
    if (active) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        "Doom scroll session already active for this habit",
      );
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + DOOM_SCROLL_DURATION_MIN * 60_000);
    const [session] = await this.db
      .insert(doomScrollSessions)
      .values({
        userId: user.id,
        habitId: habit.id,
        startedAt: now,
        endsAt,
        durationMin: DOOM_SCROLL_DURATION_MIN,
      })
      .returning();

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to start doom scroll session",
      );
    }

    await this.pushService?.onDoomScrollStart(user, habit);
    await this.scheduleDoomScrollEndJob(session.id, user.id, habit.id);

    return this.toResponse(session, now);
  }

  private async scheduleDoomScrollEndJob(
    sessionId: string,
    userId: string,
    habitId: string,
  ): Promise<void> {
    if (!this.pushQueue) {
      return;
    }

    try {
      await this.pushQueue.add(
        "doom-scroll-end",
        {
          session_id: sessionId,
          user_id: userId,
          habit_id: habitId,
        },
        {
          jobId: `doom-scroll-end:${sessionId}`,
          delay: DOOM_SCROLL_DURATION_MIN * 60_000,
          removeOnComplete: true,
        },
      );
    } catch {
      // Redis may be unavailable in tests
    }
  }

  async getActive(userId: string, habitId: string) {
    await this.getDoomScrollHabit(userId, habitId);
    const session = await this.findActiveSession(habitId);
    return session ? this.toResponse(session, new Date()) : null;
  }

  async stop(user: User, habitId: string) {
    const habit = await this.getDoomScrollHabit(user.id, habitId);
    const unfinished = await this.findUnfinishedSession(habit.id);

    if (!unfinished) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "No active doom scroll session for this habit",
      );
    }

    const now = new Date();
    const endedAt =
      unfinished.endsAt.getTime() <= now.getTime() ? unfinished.endsAt : now;

    await this.pushQueue?.remove(`doom-scroll-end:${unfinished.id}`).catch(() => undefined);

    return this.finalizeSession(user, unfinished, endedAt);
  }

  async finalizeSessionForPush(userId: string, sessionId: string, habitId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return null;
    }

    const [session] = await this.db
      .select()
      .from(doomScrollSessions)
      .where(eq(doomScrollSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return null;
    }

    const now = new Date();

    if (session.completed) {
      const naturalExpiry = session.endsAt.getTime() <= now.getTime();
      if (!naturalExpiry) {
        return null;
      }

      const habit = await this.getDoomScrollHabit(userId, habitId);
      return {
        user,
        habit,
        sessionStartedAt: session.startedAt,
      };
    }

    if (session.endsAt.getTime() > now.getTime()) {
      return null;
    }

    await this.finalizeSession(user, session, now);
    const habit = await this.getDoomScrollHabit(userId, habitId);

    return {
      user,
      habit,
      sessionStartedAt: session.startedAt,
    };
  }

  /** Worker hook: finalize sessions whose planned end has passed. */
  async finalizeExpiredSessionsUpTo(now: Date = new Date()) {
    const expired = await this.db
      .select()
      .from(doomScrollSessions)
      .where(and(eq(doomScrollSessions.completed, false), lte(doomScrollSessions.endsAt, now)));

    const results = [];
    for (const session of expired) {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) {
        continue;
      }

      const result = await this.finalizeSession(user, session, now);
      if (result.minutes_added > 0) {
        results.push(result);
      }
    }

    return results;
  }

  async listActiveForUser(userId: string) {
    const now = new Date();
    const rows = await this.db
      .select({ session: doomScrollSessions })
      .from(doomScrollSessions)
      .innerJoin(habits, eq(doomScrollSessions.habitId, habits.id))
      .where(
        and(
          eq(habits.userId, userId),
          eq(doomScrollSessions.completed, false),
          gt(doomScrollSessions.endsAt, now),
        ),
      );

    return rows.map(({ session }) => this.toResponse(session, now));
  }

  private async finalizeStaleSessionsForHabit(user: User, habitId: string) {
    const stale = await this.findStaleSessions(habitId);
    for (const session of stale) {
      await this.finalizeSession(user, session, session.endsAt);
    }
  }

  private async finalizeSession(
    user: User,
    session: typeof doomScrollSessions.$inferSelect,
    endedAt: Date,
  ) {
    const minutes = computeDoomScrollMinutes(session.startedAt, session.endsAt, endedAt);

    const [updated] = await this.db
      .update(doomScrollSessions)
      .set({ completed: true })
      .where(
        and(
          eq(doomScrollSessions.id, session.id),
          eq(doomScrollSessions.completed, false),
        ),
      )
      .returning();

    if (!updated) {
      const [existing] = await this.db
        .select()
        .from(doomScrollSessions)
        .where(eq(doomScrollSessions.id, session.id))
        .limit(1);

      if (!existing) {
        throw new ApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.INTERNAL_ERROR,
          "Failed to finalize doom scroll session",
        );
      }

      return {
        session: this.toResponse(existing, endedAt),
        minutes_added: 0,
        checkin: await this.getCheckinSnapshot(user, session.habitId),
      };
    }

    const checkin =
      minutes > 0
        ? await this.checkinService.applySessionMinutes(user, session.habitId, minutes)
        : await this.getCheckinSnapshot(user, session.habitId);

    const naturalExpiry = endedAt.getTime() >= session.endsAt.getTime() - 1000;
    if (naturalExpiry && this.pushService) {
      const habit = await this.getDoomScrollHabit(user.id, session.habitId);
      await this.pushService.onDoomScrollEnd(user, habit, session.startedAt);
      await this.pushQueue?.remove(`doom-scroll-end:${session.id}`).catch(() => undefined);
    }

    return {
      session: this.toResponse(updated, endedAt),
      minutes_added: minutes,
      checkin,
    };
  }

  private async getCheckinSnapshot(user: User, habitId: string): Promise<CheckinSnapshot> {
    const habit = await this.getDoomScrollHabit(user.id, habitId);
    const date = getUserLocalDate(new Date(), user.timezone);

    const [existing] = await this.db
      .select()
      .from(checkins)
      .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)))
      .limit(1);

    const currentGoal = Number(habit.currentGoal);
    const status = (existing?.status ?? "pending") as CheckinSnapshot["status"];

    return {
      date,
      status,
      value: existing?.value == null ? null : Number(existing.value),
      current_goal: currentGoal,
      preview_next_goal: computeNextGoal(
        toProgressionHabit(habit),
        previewStatusFromCheckin(status === "pending" ? undefined : status),
      ),
    };
  }

  private async getDoomScrollHabit(userId: string, habitId: string) {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId), eq(habits.isActive, true)))
      .limit(1);

    if (!habit) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Habit not found");
    }

    if (habit.templateId !== "social_media" || habit.type !== "limit" || habit.unit !== "minutes") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Doom scroll is only available for the social media habit",
      );
    }

    return habit;
  }

  /** Running session: not completed and planned end is still in the future. */
  private async findActiveSession(habitId: string) {
    const now = new Date();
    const [session] = await this.db
      .select()
      .from(doomScrollSessions)
      .where(
        and(
          eq(doomScrollSessions.habitId, habitId),
          eq(doomScrollSessions.completed, false),
          gt(doomScrollSessions.endsAt, now),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  /** Any incomplete session (running or expired-but-not-finalized). */
  private async findUnfinishedSession(habitId: string) {
    const [session] = await this.db
      .select()
      .from(doomScrollSessions)
      .where(
        and(eq(doomScrollSessions.habitId, habitId), eq(doomScrollSessions.completed, false)),
      )
      .limit(1);

    return session ?? null;
  }

  private async findStaleSessions(habitId: string) {
    const now = new Date();
    return this.db
      .select()
      .from(doomScrollSessions)
      .where(
        and(
          eq(doomScrollSessions.habitId, habitId),
          eq(doomScrollSessions.completed, false),
          lte(doomScrollSessions.endsAt, now),
        ),
      );
  }

  private toResponse(
    session: typeof doomScrollSessions.$inferSelect,
    now: Date,
  ): DoomScrollSessionResponse {
    return {
      id: session.id,
      habit_id: session.habitId,
      started_at: session.startedAt.toISOString(),
      ends_at: session.endsAt.toISOString(),
      duration_min: session.durationMin,
      completed: session.completed,
      remaining_sec: session.completed ? 0 : computeRemainingSeconds(now, session.endsAt),
    };
  }
}
