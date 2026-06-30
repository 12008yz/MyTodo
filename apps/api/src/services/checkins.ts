import { and, asc, eq } from "drizzle-orm";
import {
  canSkipThisWeek,
  computeEarlyRiseWindowState,
  computeNextGoal,
  getUserLocalDate,
  isWeekendDate,
  resolveCheckinStatus,
  resolveForeignLanguageCheckinStatus,
  type CheckinStatus,
} from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  isEarlyRiseCategoryKey,
  isForeignLanguageHabit,
  type BatchCheckinRequest,
  type CreateCheckinRequest,
} from "@mytodo/shared";
import type { DbExecutor } from "../db/index.js";
import {
  checkins,
  habits,
  users,
  type Habit,
  type User,
} from "../db/schema/index.js";
import { toCheckinResponse } from "../lib/checkin-mapper.js";
import { previewStatusFromCheckin, toProgressionHabit } from "../lib/habit-progression.js";
import {
  isEarlyRiseEnforcementActiveForUser,
  isWarmupDayForUser,
} from "../lib/warmup.js";

type UpsertResult = {
  checkin: typeof checkins.$inferSelect;
  currentGoal: number;
  previewNextGoal: number;
  created: boolean;
};

export class CheckinService {
  constructor(
    private readonly db: DbExecutor,
    private readonly pledgeService?: import("./pledges.js").PledgeService,
    private readonly pushService?: import("./push.js").PushService,
    private readonly readingProgressService?: import("./reading-progress.js").ReadingProgressService,
  ) {}

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

  async deleteForDate(userId: string, habitId: string, date: string): Promise<void> {
    await this.getOwnedHabit(userId, habitId);
    await this.db
      .delete(checkins)
      .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)));
  }

  async reopenForDate(userId: string, habitId: string, date: string): Promise<void> {
    await this.getOwnedHabit(userId, habitId);
    const existing = await this.findExistingCheckin(habitId, date);

    if (!existing || existing.status !== "success") {
      return;
    }

    await this.saveCheckin(
      habitId,
      date,
      "pending",
      existing.value == null ? null : Number(existing.value),
    );
  }

  async resetForeignLanguageCheckinForToday(user: User): Promise<void> {
    const habit = await this.findForeignLanguageHabit(user.id);
    if (!habit) {
      return;
    }

    const today = getUserLocalDate(new Date(), user.timezone);
    await this.deleteForDate(user.id, habit.id, today);
  }

  async markForeignLanguageDayCompleteFromVideo(user: User): Promise<void> {
    const habit = await this.findForeignLanguageHabit(user.id);
    if (!habit) {
      return;
    }

    const today = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.findExistingCheckin(habit.id, today);

    if (existing?.status === "skipped" || existing?.status === "success") {
      return;
    }

    const value = existing?.value == null ? 0 : Number(existing.value);
    await this.saveCheckin(habit.id, today, "success", value);
  }

  async reconcileForeignLanguageMinutes(_user: User): Promise<void> {
    // Video progress is tracked separately from timer checkins.
  }

  async findForeignLanguageHabitForUser(userId: string) {
    return this.findForeignLanguageHabit(userId);
  }

  private async findForeignLanguageHabit(userId: string) {
    const rows = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.isActive, true)));

    return (
      rows.find((habit) =>
        isForeignLanguageHabit({ category_key: habit.categoryKey, name: habit.name }),
      ) ?? null
    );
  }

  async upsert(user: User, body: CreateCheckinRequest): Promise<UpsertResult> {
    const habit = await this.getOwnedHabit(user.id, body.habit_id);
    const date = body.date ?? getUserLocalDate(new Date(), user.timezone);
    const existing = await this.findExistingCheckin(habit.id, date);
    const requestBody =
      habit.templateId === "books" &&
      body.value !== undefined &&
      existing?.value != null &&
      body.value < Number(existing.value)
        ? { ...body, value: Number(existing.value) }
        : body;
    const { status, value } = await this.resolveStatus(habit, requestBody, date, user);

    if (habit.type === "abstinence" && status === "fail") {
      await this.db
        .update(habits)
        .set({ lastRelapseAt: new Date() })
        .where(eq(habits.id, habit.id));
    }

    const checkin = await this.saveCheckin(habit.id, date, status, value);

    if (habit.templateId === "books" && value != null) {
      await this.readingProgressService?.creditFromCheckinValue(
        user.id,
        habit.id,
        date,
        value,
        this.db,
      );
    }

    if (status === "fail") {
      await this.pledgeService?.failActivePledgeForHabit(habit.id, this.db);
    }

    await this.pushService?.onCheckinInstant(user, habit, status, existing?.status);

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
    return this.applySessionValue(user, habitId, minutes);
  }

  async applySessionValue(
    user: User,
    habitId: string,
    value: number,
    options?: { mode?: "add" | "set" },
  ) {
    const mode = options?.mode ?? "add";
    if (mode === "add" && value <= 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "value must be greater than zero",
      );
    }
    if (mode === "set" && value < 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "value must be zero or greater",
      );
    }

    const habit = await this.getOwnedHabit(user.id, habitId);
    const date = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.findExistingCheckin(habit.id, date);

    if (existing?.status === "skipped") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot add session value on a skipped day",
      );
    }

    const currentValue = existing?.value == null ? 0 : Number(existing.value);
    const rawValue = mode === "set" ? value : currentValue + value;
    const newValue =
      habit.templateId === "books" ? Math.max(currentValue, rawValue) : rawValue;
    let status = this.resolveTargetHabitCheckinStatus(habit, newValue);
    if (
      isForeignLanguageHabit({ category_key: habit.categoryKey, name: habit.name }) &&
      existing?.status === "success"
    ) {
      status = "success";
    }
    const checkin = await this.saveCheckin(habit.id, date, status, newValue);

    if (habit.templateId === "books") {
      await this.readingProgressService?.creditFromCheckinValue(
        user.id,
        habit.id,
        date,
        newValue,
        this.db,
      );
    }

    if (status === "fail") {
      await this.pledgeService?.failActivePledgeForHabit(habit.id, this.db);
    }

    await this.pushService?.onCheckinInstant(user, habit, status, existing?.status);

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
      const batchService = new CheckinService(
        tx,
        this.pledgeService,
        undefined,
        this.readingProgressService,
      );
      const batchResults: UpsertResult[] = [];

      for (const item of body.checkins) {
        batchResults.push(await batchService.upsert(user, item));
      }

      return batchResults;
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

  async processExpiredEarlyRiseWindows(now: Date = new Date()): Promise<number> {
    const rows = await this.db
      .select({ habit: habits, user: users })
      .from(habits)
      .innerJoin(users, eq(habits.userId, users.id))
      .where(and(eq(habits.isActive, true), eq(habits.categoryKey, "early_rise")));

    let failed = 0;

    for (const { habit, user } of rows) {
      if (!user.wakeTime) {
        continue;
      }

      const date = getUserLocalDate(now, user.timezone);

      if (!isEarlyRiseEnforcementActiveForUser(user, date)) {
        continue;
      }

      const existing = await this.findExistingCheckin(habit.id, date);

      if (
        existing &&
        (existing.status === "success" ||
          existing.status === "fail" ||
          existing.status === "skipped")
      ) {
        continue;
      }

      const window = computeEarlyRiseWindowState(
        user.wakeTime,
        Number(habit.currentGoal),
        now,
        user.timezone,
      );

      if (window.phase !== "expired") {
        continue;
      }

      await this.upsert(user, { habit_id: habit.id, status: "fail", date });
      failed += 1;
    }

    return failed;
  }

  /** Auto-skip early rise on Saturday and Sunday (no wake window, no GG). */
  async ensureEarlyRiseWeekendSkips(user: User, date: string): Promise<void> {
    if (!isWeekendDate(date)) {
      return;
    }

    const rows = await this.db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.userId, user.id),
          eq(habits.isActive, true),
          eq(habits.categoryKey, "early_rise"),
        ),
      );

    for (const habit of rows) {
      const existing = await this.findExistingCheckin(habit.id, date);

      if (
        existing &&
        (existing.status === "success" ||
          existing.status === "fail" ||
          existing.status === "skipped")
      ) {
        continue;
      }

      await this.saveCheckin(habit.id, date, "skipped", null);
    }
  }

  private async resolveStatus(
    habit: Habit,
    body: CreateCheckinRequest,
    date: string,
    user: User,
  ) {
    if (body.status === "skipped") {
      this.assertSkipAllowed(habit);
      if (!isWarmupDayForUser(user, date)) {
        await this.assertCanSkip(habit.id, date);
      }
      await this.assertNoActivePledge(habit.id);
      return { status: "skipped" as const, value: null };
    }

    if (isEarlyRiseCategoryKey(habit.categoryKey)) {
      return this.resolveEarlyRiseStatus(habit, body, date, user);
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
        "Explicit fail status is only allowed for abstinence and early rise habits",
      );
    }

    if (body.value === undefined) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "value is required for target and limit habits",
      );
    }

    const status = this.resolveTargetHabitCheckinStatus(
      habit,
      body.value,
    );
    return { status, value: body.value };
  }

  private resolveTargetHabitCheckinStatus(
    habit: Habit,
    value: number,
  ): CheckinStatus {
    if (isForeignLanguageHabit({ category_key: habit.categoryKey, name: habit.name })) {
      return resolveForeignLanguageCheckinStatus(value, Number(habit.currentGoal));
    }

    return resolveCheckinStatus(this.toCheckinHabit(habit), { value });
  }

  private resolveEarlyRiseStatus(
    habit: Habit,
    body: CreateCheckinRequest,
    date: string,
    user: User,
  ) {
    const today = getUserLocalDate(new Date(), user.timezone);
    if (date !== today) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Early rise checkins are only allowed for today",
      );
    }

    if (!user.wakeTime) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Set wake time in profile to use early rise",
      );
    }

    const enforcementActive = isEarlyRiseEnforcementActiveForUser(user, date);

    if (!enforcementActive) {
      if (body.status === "fail") {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Сегодня разгонный день — штрафов нет",
        );
      }

      const window = computeEarlyRiseWindowState(
        user.wakeTime,
        Number(habit.currentGoal),
        new Date(),
        user.timezone,
      );

      if (window.phase === "window") {
        return { status: "success" as const, value: Number(habit.currentGoal) };
      }

      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        window.phase === "before"
          ? `Рано. Окно откроется в ${window.target_wake_time}`
          : "Сегодня подъём по желанию — окно уже закрыто",
      );
    }

    const window = computeEarlyRiseWindowState(
      user.wakeTime,
      Number(habit.currentGoal),
      new Date(),
      user.timezone,
    );

    if (body.status === "fail") {
      if (window.phase !== "expired") {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Early rise fail is only allowed after the confirmation window",
        );
      }

      return { status: "fail" as const, value: null };
    }

    if (window.phase === "before") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        `Рано. Окно откроется в ${window.target_wake_time}`,
      );
    }

    if (window.phase === "expired") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Время вышло — отметиться уже нельзя",
      );
    }

    return { status: "success" as const, value: Number(habit.currentGoal) };
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

  private async assertNoActivePledge(habitId: string) {
    await this.pledgeService?.assertNoActivePledge(habitId);
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
    status: "success" | "fail" | "skipped" | "pending",
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
      templateId: habit.templateId,
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
