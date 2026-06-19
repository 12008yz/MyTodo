import { and, asc, eq } from "drizzle-orm";
import {
  canSkipThisWeek,
  computeNextGoal,
  getUserLocalDate,
  resolveCheckinStatus,
} from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  type BatchCheckinRequest,
  type CreateCheckinRequest,
} from "@mytodo/shared";
import type { DbExecutor } from "../db/index.js";
import { checkins, habits, type Habit, type User } from "../db/schema/index.js";
import { toCheckinResponse } from "../lib/checkin-mapper.js";
import { previewStatusFromCheckin, toProgressionHabit } from "../lib/habit-progression.js";

type UpsertResult = {
  checkin: typeof checkins.$inferSelect;
  currentGoal: number;
  previewNextGoal: number;
  created: boolean;
};

export class CheckinService {
  constructor(private readonly db: DbExecutor) {}

  async listByDate(userId: string, date: string) {
    const rows = await this.db
      .select({
        checkin: checkins,
        habit: habits,
      })
      .from(checkins)
      .innerJoin(habits, eq(checkins.habitId, habits.id))
      .where(and(eq(habits.userId, userId), eq(checkins.date, date)))
      .orderBy(asc(habits.createdAt));

    return rows.map(({ checkin, habit }) =>
      this.toResponse(checkin, habit),
    );
  }

  async upsert(user: User, body: CreateCheckinRequest): Promise<UpsertResult> {
    const habit = await this.getOwnedHabit(user.id, body.habit_id);
    const date = body.date ?? getUserLocalDate(new Date(), user.timezone);
    const existing = await this.findExistingCheckin(habit.id, date);
    const { status, value } = await this.resolveStatus(habit, body, date);

    if (habit.type === "abstinence" && status === "fail") {
      await this.db
        .update(habits)
        .set({ lastRelapseAt: new Date() })
        .where(eq(habits.id, habit.id));
    }

    const checkin = await this.saveCheckin(habit.id, date, status, value);
    const currentGoal = Number(habit.currentGoal);

    return {
      checkin,
      currentGoal,
      previewNextGoal: computeNextGoal(
        toProgressionHabit(habit),
        previewStatusFromCheckin(status),
      ),
      created: !existing,
    };
  }

  async applySessionMinutes(user: User, habitId: string, minutes: number) {
    if (minutes <= 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "minutes must be greater than zero",
      );
    }

    const habit = await this.getOwnedHabit(user.id, habitId);
    const date = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.findExistingCheckin(habit.id, date);

    if (existing?.status === "skipped") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot add minutes on a skipped day",
      );
    }

    const currentValue = existing?.value == null ? 0 : Number(existing.value);
    const newValue = currentValue + minutes;
    const status = resolveCheckinStatus(this.toCheckinHabit(habit), { value: newValue });
    const checkin = await this.saveCheckin(habit.id, date, status, newValue);
    const currentGoal = Number(habit.currentGoal);

    return {
      date,
      status: checkin.status as "success" | "fail" | "pending" | "skipped",
      value: newValue,
      current_goal: currentGoal,
      preview_next_goal: computeNextGoal(
        toProgressionHabit(habit),
        previewStatusFromCheckin(status),
      ),
    };
  }

  async batchUpsert(user: User, body: BatchCheckinRequest) {
    this.assertNoDuplicateBatchItems(user, body);

    for (const item of body.checkins) {
      await this.getOwnedHabit(user.id, item.habit_id);
    }

    const conflicts: Array<{
      habit_id: string;
      date: string;
      server_updated_at: string;
    }> = [];

    for (const item of body.checkins) {
      const date = item.date ?? getUserLocalDate(new Date(), user.timezone);
      const existing = await this.findExistingCheckin(item.habit_id, date);

      if (!existing) {
        continue;
      }

      const clientUpdatedAt = item.updated_at ? new Date(item.updated_at).getTime() : null;
      const serverIsNewer =
        clientUpdatedAt === null || existing.updatedAt.getTime() > clientUpdatedAt;

      if (serverIsNewer) {
        conflicts.push({
          habit_id: item.habit_id,
          date,
          server_updated_at: existing.updatedAt.toISOString(),
        });
      }
    }

    if (conflicts.length > 0) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        "Checkin sync conflict",
        { conflicts },
      );
    }

    return this.db.transaction(async (tx) => {
      const batchService = new CheckinService(tx);
      const results: UpsertResult[] = [];

      for (const item of body.checkins) {
        results.push(await batchService.upsert(user, item));
      }

      return results;
    });
  }

  private assertNoDuplicateBatchItems(user: User, body: BatchCheckinRequest) {
    const today = getUserLocalDate(new Date(), user.timezone);
    const seen = new Set<string>();

    for (const item of body.checkins) {
      const date = item.date ?? today;
      const key = `${item.habit_id}:${date}`;

      if (seen.has(key)) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Duplicate habit_id and date in batch",
          { habit_id: item.habit_id, date },
        );
      }

      seen.add(key);
    }
  }

  private async resolveStatus(
    habit: Habit,
    body: CreateCheckinRequest,
    date: string,
  ) {
    if (body.status === "skipped") {
      this.assertSkipAllowed(habit);
      await this.assertCanSkip(habit.id, date);
      await this.assertNoActivePledge(habit.id);
      return { status: "skipped" as const, value: null };
    }

    if (habit.type === "abstinence") {
      if (body.status !== "fail") {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Abstinence habits only accept status fail",
        );
      }

      return { status: "fail" as const, value: null };
    }

    if (body.status === "fail") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Explicit fail status is only allowed for abstinence habits",
      );
    }

    if (body.value === undefined) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "value is required for target and limit habits",
      );
    }

    const status = resolveCheckinStatus(this.toCheckinHabit(habit), { value: body.value });
    return { status, value: body.value };
  }

  private assertSkipAllowed(habit: Habit) {
    if (habit.side !== "light" || !habit.allowsWeeklySkip) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Skip is only allowed for light habits",
      );
    }
  }

  private async assertCanSkip(habitId: string, date: string) {
    const skippedDates = (await this.listSkippedDates(habitId)).filter((skipDate) => skipDate !== date);

    if (!canSkipThisWeek(skippedDates, date)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Maximum 2 skips per calendar week allowed",
      );
    }
  }

  private async assertNoActivePledge(_habitId: string) {
    // Block 11: reject skip when habit has an active pledge.
  }

  private async listSkippedDates(habitId: string) {
    const rows = await this.db
      .select({ date: checkins.date })
      .from(checkins)
      .where(and(eq(checkins.habitId, habitId), eq(checkins.status, "skipped")));

    return rows.map((row) => row.date);
  }

  private async saveCheckin(
    habitId: string,
    date: string,
    status: "success" | "fail" | "skipped",
    value: number | null,
  ) {
    const now = new Date();
    const [checkin] = await this.db
      .insert(checkins)
      .values({
        habitId,
        date,
        status,
        value: value === null ? null : String(value),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [checkins.habitId, checkins.date],
        set: {
          status,
          value: value === null ? null : String(value),
          updatedAt: now,
        },
      })
      .returning();

    if (!checkin) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to save checkin",
      );
    }

    return checkin;
  }

  private async findExistingCheckin(habitId: string, date: string) {
    const [row] = await this.db
      .select()
      .from(checkins)
      .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)))
      .limit(1);

    return row ?? null;
  }

  private async getOwnedHabit(userId: string, habitId: string) {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId), eq(habits.isActive, true)))
      .limit(1);

    if (!habit) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Habit not found");
    }

    return habit;
  }

  private toCheckinHabit(habit: Habit) {
    return {
      type: habit.type as "target" | "limit" | "abstinence",
      side: habit.side as "light" | "dark",
      currentGoal: Number(habit.currentGoal),
    };
  }

  private toResponse(checkin: typeof checkins.$inferSelect, habit: Habit) {
    const currentGoal = Number(habit.currentGoal);
    const previewNextGoal = computeNextGoal(
      toProgressionHabit(habit),
      previewStatusFromCheckin(checkin.status),
    );

    return toCheckinResponse(checkin, currentGoal, previewNextGoal);
  }
}
