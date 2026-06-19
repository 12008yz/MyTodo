import { and, eq, isNull } from "drizzle-orm";
import { getUserLocalDate } from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  type PomodoroSessionResponse,
} from "@mytodo/shared";
import type { Database, DbExecutor } from "../db/index.js";
import { habits, pomodoroSessions, type User } from "../db/schema/index.js";
import { computeRemainingSeconds } from "../lib/session-minutes.js";
import { CheckinService } from "./checkins.js";
import type { PledgeService } from "./pledges.js";

export class PomodoroService {
  constructor(
    private readonly db: DbExecutor,
    private readonly pledgeService?: PledgeService,
  ) {}

  async start(user: User, habitId: string): Promise<PomodoroSessionResponse> {
    const habit = await this.getPomodoroHabit(user.id, habitId);
    const active = await this.findActiveSession(habitId);

    if (active) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        "Pomodoro session already active for this habit",
      );
    }

    const now = new Date();
    const [session] = await this.db
      .insert(pomodoroSessions)
      .values({
        userId: user.id,
        habitId: habit.id,
        startedAt: now,
        workMin: user.pomodoroWorkMin,
      })
      .returning();

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to start pomodoro session",
      );
    }

    return this.toResponse(session, now);
  }

  async getActive(userId: string, habitId: string) {
    await this.getPomodoroHabit(userId, habitId);
    const session = await this.findActiveSession(habitId);
    return session ? this.toResponse(session, new Date()) : null;
  }

  async complete(user: User, habitId: string) {
    const habit = await this.getPomodoroHabit(user.id, habitId);
    const session = await this.findActiveSession(habit.id);

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "No active pomodoro session for this habit",
      );
    }

    const run = async (executor: DbExecutor) => {
      const now = new Date();
      const [updated] = await executor
        .update(pomodoroSessions)
        .set({ endedAt: now, completed: true })
        .where(
          and(
            eq(pomodoroSessions.id, session.id),
            eq(pomodoroSessions.completed, false),
            isNull(pomodoroSessions.endedAt),
          ),
        )
        .returning();

      if (!updated) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.CONFLICT,
          "Pomodoro session was already completed or stopped",
        );
      }

      const checkin = await new CheckinService(executor, this.pledgeService).applySessionMinutes(
        user,
        habit.id,
        session.workMin,
      );

      return {
        session: this.toResponse(updated, now),
        minutes_added: session.workMin,
        checkin,
      };
    };

    if ("transaction" in this.db) {
      return (this.db as Database).transaction(run);
    }

    return run(this.db);
  }

  async stop(userId: string, habitId: string) {
    const habit = await this.getPomodoroHabit(userId, habitId);
    const session = await this.findActiveSession(habit.id);

    if (!session) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "No active pomodoro session for this habit",
      );
    }

    const now = new Date();
    const [updated] = await this.db
      .update(pomodoroSessions)
      .set({ endedAt: now, completed: false })
      .where(eq(pomodoroSessions.id, session.id))
      .returning();

    if (!updated) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to stop pomodoro session",
      );
    }

    return this.toResponse(updated, now);
  }

  async countCompletedToday(userId: string, timezone: string) {
    const today = getUserLocalDate(new Date(), timezone);
    const rows = await this.db
      .select({ startedAt: pomodoroSessions.startedAt })
      .from(pomodoroSessions)
      .where(and(eq(pomodoroSessions.userId, userId), eq(pomodoroSessions.completed, true)));

    return rows.filter(
      (row) => getUserLocalDate(row.startedAt, timezone) === today,
    ).length;
  }

  private async getPomodoroHabit(userId: string, habitId: string) {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId), eq(habits.isActive, true)))
      .limit(1);

    if (!habit) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Habit not found");
    }

    if (habit.side !== "light" || habit.unit !== "minutes") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Pomodoro is only available for light habits measured in minutes",
      );
    }

    return habit;
  }

  private async findActiveSession(habitId: string) {
    const [session] = await this.db
      .select()
      .from(pomodoroSessions)
      .where(
        and(
          eq(pomodoroSessions.habitId, habitId),
          eq(pomodoroSessions.completed, false),
          isNull(pomodoroSessions.endedAt),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  private toResponse(
    session: typeof pomodoroSessions.$inferSelect,
    now: Date,
  ): PomodoroSessionResponse {
    const endsAt = new Date(session.startedAt.getTime() + session.workMin * 60_000);

    return {
      id: session.id,
      habit_id: session.habitId,
      started_at: session.startedAt.toISOString(),
      ended_at: session.endedAt?.toISOString() ?? null,
      work_min: session.workMin,
      completed: session.completed,
      remaining_sec: session.completed || session.endedAt
        ? 0
        : computeRemainingSeconds(now, endsAt),
    };
  }
}
