import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { getUserLocalDate } from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  SESSION_TARGET_MIN,
  computeSessionCompletionMinutes,
  sessionBudgetMinutes,
  sessionTotalSeconds,
  type HabitSessionCompleteResponse,
  type HabitSessionResponse,
} from "@mytodo/shared";
import type { Database, DbExecutor } from "../db/index.js";
import { habitSessions, habits, type User } from "../db/schema/index.js";
import { computeRemainingSeconds } from "../lib/session-minutes.js";
import { CheckinService } from "./checkins.js";
import type { PledgeService } from "./pledges.js";

type StartHabitSessionOptions = {
  blockId?: string;
  plannedMin?: number;
  plannedSeconds?: number;
};

type CompleteHabitSessionOptions = {
  blockId?: string;
  actualValue?: number;
  endedEarly?: boolean;
};

type CompletedBlockMeta = {
  actual_value: number;
  actual_minutes: number;
};

export class HabitSessionService {
  constructor(
    private readonly db: DbExecutor,
    private readonly pledgeService?: PledgeService,
    private readonly readingProgressService?: import("./reading-progress.js").ReadingProgressService,
  ) {}

  async start(
    user: User,
    habitId: string,
    opts: StartHabitSessionOptions = {},
  ): Promise<HabitSessionResponse> {
    const habit = await this.getSupportedHabit(user.id, habitId);
    const active = await this.findActiveSession(habit.id);

    if (active) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        "Habit session already active for this habit",
      );
    }

    const now = new Date();
    const plannedSeconds =
      opts.plannedSeconds != null && opts.plannedSeconds > 0 ? opts.plannedSeconds : null;
    const plannedMin =
      opts.plannedMin ??
      (plannedSeconds != null ? sessionBudgetMinutes(plannedSeconds) : SESSION_TARGET_MIN);
    const [session] = await this.db
      .insert(habitSessions)
      .values({
        userId: user.id,
        habitId: habit.id,
        blockId: opts.blockId ?? null,
        startedAt: now,
        plannedMin,
        plannedSeconds,
      })
      .returning();

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to start habit session",
      );
    }

    return this.toResponse(session, now);
  }

  async complete(
    user: User,
    habitId: string,
    opts: CompleteHabitSessionOptions = {},
  ): Promise<HabitSessionCompleteResponse> {
    const habit = await this.getSupportedHabit(user.id, habitId);
    const session = await this.findActiveSession(habit.id);

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "No active habit session for this habit",
      );
    }

    const elapsedMs = this.getExerciseElapsedMs(session, new Date());
    const MIN_SESSION_MS = 5_000;
    const totalMs = sessionTotalSeconds(session) * 1000;
    const completedFullTimer =
      !(opts.endedEarly ?? false) && elapsedMs >= Math.max(0, totalMs - 500);

    if (elapsedMs < MIN_SESSION_MS && !completedFullTimer) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Session is too short to complete",
      );
    }

    const actualMin = computeSessionCompletionMinutes(
      elapsedMs,
      session.plannedMin,
      session.plannedSeconds,
      opts.endedEarly ?? false,
    );

    let valueToAdd: number;
    const useDailyTotal = habit.side === "dark" && habit.type === "limit";

    if (opts.endedEarly) {
      if (habit.unit === "minutes") {
        valueToAdd = session.plannedMin;
      } else if (useDailyTotal) {
        if (opts.actualValue == null || opts.actualValue < 0) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR,
            "actual_value must be zero or greater for limit habits",
          );
        }
        valueToAdd = opts.actualValue;
      } else {
        if (opts.actualValue == null || opts.actualValue <= 0) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR,
            "actual_value must be greater than zero for non-minute habits",
          );
        }
        valueToAdd = opts.actualValue;
      }
    } else if (habit.unit === "minutes") {
      valueToAdd = actualMin;
      if (valueToAdd <= 0) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Computed minutes must be greater than zero",
        );
      }
    } else if (useDailyTotal) {
      if (opts.actualValue == null || opts.actualValue < 0) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "actual_value must be zero or greater for limit habits",
        );
      }
      valueToAdd = opts.actualValue;
    } else {
      if (opts.actualValue == null || opts.actualValue <= 0) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "actual_value must be greater than zero for non-minute habits",
        );
      }
      valueToAdd = opts.actualValue;
    }

    const run = async (executor: DbExecutor): Promise<HabitSessionCompleteResponse> => {
      const now = new Date();
      const [updated] = await executor
        .update(habitSessions)
        .set({
          endedAt: now,
          completed: true,
          actualMin,
          valueAdded: String(valueToAdd),
          blockId: opts.blockId ?? session.blockId,
        })
        .where(
          and(
            eq(habitSessions.id, session.id),
            eq(habitSessions.completed, false),
            isNull(habitSessions.endedAt),
          ),
        )
        .returning();

      if (!updated) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.CONFLICT,
          "Habit session was already completed or stopped",
        );
      }

      const checkin = await new CheckinService(
        executor,
        this.pledgeService,
        undefined,
        this.readingProgressService,
      ).applySessionValue(
        user,
        habit.id,
        valueToAdd,
        useDailyTotal ? { mode: "set" } : undefined,
      );

      return {
        session: this.toResponse(updated, now),
        checkin,
        value_added: valueToAdd,
      };
    };

    if ("transaction" in this.db) {
      return (this.db as Database).transaction(run);
    }

    return run(this.db);
  }

  async stop(userId: string, habitId: string): Promise<HabitSessionResponse> {
    const habit = await this.getSupportedHabit(userId, habitId);
    const session = await this.findActiveSession(habit.id);

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "No active habit session for this habit",
      );
    }

    const now = new Date();
    const [updated] = await this.db
      .update(habitSessions)
      .set({ endedAt: now, completed: false })
      .where(
        and(
          eq(habitSessions.id, session.id),
          eq(habitSessions.completed, false),
          isNull(habitSessions.endedAt),
        ),
      )
      .returning();

    if (!updated) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to stop habit session",
      );
    }

    return this.toResponse(updated, now);
  }

  async getActive(userId: string, habitId: string): Promise<HabitSessionResponse | null> {
    const habit = await this.getSupportedHabit(userId, habitId);
    const session = await this.findActiveSession(habit.id);
    return session ? this.toResponse(session, new Date()) : null;
  }

  async pause(userId: string, habitId: string): Promise<HabitSessionResponse> {
    const habit = await this.getSupportedHabit(userId, habitId);
    const session = await this.findActiveSession(habit.id);

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "No active habit session for this habit",
      );
    }

    const now = new Date();
    if (session.pausedAt && session.pausedRemainingSeconds != null) {
      return this.toResponse(session, now);
    }

    const endsAt = new Date(
      session.startedAt.getTime() + sessionTotalSeconds(session) * 1000,
    );
    const remaining = computeRemainingSeconds(now, endsAt);
    const [updated] = await this.db
      .update(habitSessions)
      .set({
        pausedAt: now,
        pausedRemainingSeconds: remaining,
      })
      .where(eq(habitSessions.id, session.id))
      .returning();

    if (!updated) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to pause habit session",
      );
    }

    return this.toResponse(updated, now);
  }

  async resume(userId: string, habitId: string): Promise<HabitSessionResponse> {
    const habit = await this.getSupportedHabit(userId, habitId);
    const session = await this.findActiveSession(habit.id);

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "No active habit session for this habit",
      );
    }

    const now = new Date();
    if (!session.pausedAt || session.pausedRemainingSeconds == null) {
      return this.toResponse(session, now);
    }

    const totalSeconds = sessionTotalSeconds(session);
    const elapsedSeconds = Math.max(0, totalSeconds - session.pausedRemainingSeconds);
    const newStartedAt = new Date(now.getTime() - elapsedSeconds * 1000);
    const [updated] = await this.db
      .update(habitSessions)
      .set({
        startedAt: newStartedAt,
        pausedAt: null,
        pausedRemainingSeconds: null,
      })
      .where(eq(habitSessions.id, session.id))
      .returning();

    if (!updated) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to resume habit session",
      );
    }

    return this.toResponse(updated, now);
  }

  async listCompletedBlockMetaForDate(
    userId: string,
    timezone: string,
    date: string,
  ): Promise<Map<string, CompletedBlockMeta>> {
    const rows = await this.db
      .select()
      .from(habitSessions)
      .where(
        and(
          eq(habitSessions.userId, userId),
          eq(habitSessions.completed, true),
          isNotNull(habitSessions.blockId),
          isNotNull(habitSessions.endedAt),
        ),
      );

    const result = new Map<string, CompletedBlockMeta>();
    for (const session of rows) {
      const localDate = getUserLocalDate(session.endedAt ?? session.startedAt, timezone);
      if (localDate !== date || !session.blockId) {
        continue;
      }
      result.set(session.blockId, {
        actual_value: session.valueAdded == null ? 0 : Number(session.valueAdded),
        actual_minutes: session.actualMin ?? 0,
      });
    }

    return result;
  }

  async findActiveBlockIdForUser(userId: string): Promise<string | null> {
    const [session] = await this.db
      .select()
      .from(habitSessions)
      .where(
        and(
          eq(habitSessions.userId, userId),
          eq(habitSessions.completed, false),
          isNull(habitSessions.endedAt),
          isNotNull(habitSessions.blockId),
        ),
      )
      .orderBy(asc(habitSessions.startedAt))
      .limit(1);

    return session?.blockId ?? null;
  }

  toResponse(session: typeof habitSessions.$inferSelect, now: Date): HabitSessionResponse {
    const endsAt = new Date(
      session.startedAt.getTime() + sessionTotalSeconds(session) * 1000,
    );
    const isPaused = Boolean(
      session.pausedAt && !session.completed && !session.endedAt,
    );

    return {
      id: session.id,
      habit_id: session.habitId,
      block_id: session.blockId,
      started_at: session.startedAt.toISOString(),
      ended_at: session.endedAt?.toISOString() ?? null,
      planned_min: session.plannedMin,
      planned_seconds: session.plannedSeconds,
      actual_min: session.actualMin,
      value_added: session.valueAdded == null ? null : Number(session.valueAdded),
      completed: session.completed,
      is_paused: isPaused,
      remaining_seconds:
        session.completed || session.endedAt
          ? 0
          : isPaused && session.pausedRemainingSeconds != null
            ? session.pausedRemainingSeconds
            : computeRemainingSeconds(now, endsAt),
    };
  }

  private getExerciseElapsedMs(
    session: typeof habitSessions.$inferSelect,
    now: Date,
  ): number {
    if (session.pausedAt && session.pausedRemainingSeconds != null) {
      const totalMs = sessionTotalSeconds(session) * 1000;
      return Math.max(0, totalMs - session.pausedRemainingSeconds * 1000);
    }

    return Math.max(0, now.getTime() - session.startedAt.getTime());
  }

  private async getSupportedHabit(userId: string, habitId: string) {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId), eq(habits.isActive, true)))
      .limit(1);

    if (!habit) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Habit not found");
    }

    const isLightHabit = habit.side === "light";
    const isAllowedDarkLimit = habit.side === "dark"
      && habit.type === "limit"
      && habit.templateId !== "social_media";

    if (!isLightHabit && !isAllowedDarkLimit) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Habit sessions are not available for this habit",
      );
    }

    return habit;
  }

  private async findActiveSession(habitId: string) {
    const [session] = await this.db
      .select()
      .from(habitSessions)
      .where(
        and(
          eq(habitSessions.habitId, habitId),
          eq(habitSessions.completed, false),
          isNull(habitSessions.endedAt),
        ),
      )
      .limit(1);

    return session ?? null;
  }
}
