import { and, eq, inArray } from "drizzle-orm";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  getKnownBookPageCount,
  isKnownBookId,
  type HabitReadingProgress as HabitReadingProgressResponse,
} from "@mytodo/shared";
import type { DbExecutor } from "../db/index.js";
import { habitReadingProgress, habits, type Habit, type User } from "../db/schema/index.js";

type SelectBookOptions = {
  planDate?: string;
  checkinBaseline?: number;
};

export class ReadingProgressService {
  constructor(private readonly db: DbExecutor) {}

  async getForHabit(userId: string, habitId: string): Promise<HabitReadingProgressResponse | null> {
    const row = await this.findRow(userId, habitId);
    return row ? this.toResponse(row) : null;
  }

  async listForHabits(
    userId: string,
    habitIds: string[],
  ): Promise<Map<string, HabitReadingProgressResponse>> {
    if (habitIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select()
      .from(habitReadingProgress)
      .where(
        and(eq(habitReadingProgress.userId, userId), inArray(habitReadingProgress.habitId, habitIds)),
      );

    return new Map(rows.map((row) => [row.habitId, this.toResponse(row)]));
  }

  async selectBook(
    user: User,
    habitId: string,
    bookId: string,
    options: SelectBookOptions = {},
  ): Promise<HabitReadingProgressResponse> {
    const habit = await this.getBooksHabit(user.id, habitId);
    if (!isKnownBookId(bookId)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, "Unknown book_id");
    }

    const now = new Date();
    const existing = await this.findRow(user.id, habit.id);
    const planDate = options.planDate;
    const checkinBaseline = Math.max(0, options.checkinBaseline ?? 0);

    if (existing?.bookId === bookId) {
      const [updated] = await this.db
        .update(habitReadingProgress)
        .set({ updatedAt: now })
        .where(eq(habitReadingProgress.id, existing.id))
        .returning();
      return this.toResponse(updated!);
    }

    const [inserted] = await this.db
      .insert(habitReadingProgress)
      .values({
        userId: user.id,
        habitId: habit.id,
        bookId,
        pagesRead: 0,
        pagesCreditedToday: planDate ? checkinBaseline : 0,
        lastReadPage: 1,
        timerRemainingSeconds: null,
        timerSavedDate: null,
        readerDayStartPage: null,
        readerDayDate: null,
        lastCheckinDate: planDate ?? null,
        startedAt: now,
        completedAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: habitReadingProgress.habitId,
        set: {
          bookId,
          pagesRead: 0,
          pagesCreditedToday: planDate ? checkinBaseline : 0,
          lastReadPage: 1,
          timerRemainingSeconds: null,
          timerSavedDate: null,
          readerDayStartPage: null,
          readerDayDate: null,
          lastCheckinDate: planDate ?? null,
          startedAt: now,
          completedAt: null,
          updatedAt: now,
        },
      })
      .returning();

    if (!inserted) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to save reading progress",
      );
    }

    return this.toResponse(inserted);
  }

  async updateBookmark(
    userId: string,
    habitId: string,
    data: {
      lastReadPage?: number;
      timerRemainingSeconds?: number;
      timerSavedDate?: string;
      readerDayStartPage?: number;
      readerDayDate?: string;
    },
  ): Promise<HabitReadingProgressResponse> {
    await this.getBooksHabit(userId, habitId);
    const row = await this.findRow(userId, habitId);
    if (!row) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Select a book before setting a bookmark",
      );
    }

    const now = new Date();
    const updates: Partial<typeof habitReadingProgress.$inferInsert> = {
      updatedAt: now,
    };

    if (data.lastReadPage !== undefined) {
      const pageCount = getKnownBookPageCount(row.bookId);
      updates.lastReadPage =
        pageCount != null
          ? Math.min(Math.max(1, data.lastReadPage), pageCount)
          : Math.max(1, data.lastReadPage);
    }

    if (data.timerRemainingSeconds !== undefined) {
      updates.timerRemainingSeconds = Math.max(0, data.timerRemainingSeconds);
    }

    if (data.timerSavedDate !== undefined) {
      updates.timerSavedDate = data.timerSavedDate;
    }

    if (data.readerDayStartPage !== undefined) {
      updates.readerDayStartPage = Math.max(1, data.readerDayStartPage);
    }

    if (data.readerDayDate !== undefined) {
      updates.readerDayDate = data.readerDayDate;
    }

    const [updated] = await this.db
      .update(habitReadingProgress)
      .set(updates)
      .where(eq(habitReadingProgress.id, row.id))
      .returning();

    if (!updated) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to update bookmark",
      );
    }

    return this.toResponse(updated);
  }

  async creditFromCheckinValue(
    userId: string,
    habitId: string,
    date: string,
    checkinValue: number,
    executor?: DbExecutor,
  ): Promise<void> {
    const db = executor ?? this.db;
    const habit = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!habit || habit.templateId !== "books") {
      return;
    }

    const row = await this.findRow(userId, habitId, db);
    if (!row) {
      return;
    }

    const now = new Date();
    let pagesRead = row.pagesRead;
    let pagesCreditedToday = row.pagesCreditedToday;
    let lastCheckinDate = row.lastCheckinDate;

    if (lastCheckinDate !== date) {
      lastCheckinDate = date;
      pagesCreditedToday = 0;
    }

    if (checkinValue > pagesCreditedToday) {
      pagesRead += checkinValue - pagesCreditedToday;
      pagesCreditedToday = checkinValue;
    }

    const pageCount = getKnownBookPageCount(row.bookId);
    const completedAt =
      pageCount != null && pagesRead >= pageCount ? (row.completedAt ?? now) : null;

    await db
      .update(habitReadingProgress)
      .set({
        pagesRead,
        pagesCreditedToday,
        lastCheckinDate,
        completedAt,
        updatedAt: now,
      })
      .where(eq(habitReadingProgress.id, row.id));
  }

  private async findRow(userId: string, habitId: string, executor: DbExecutor = this.db) {
    const [row] = await executor
      .select()
      .from(habitReadingProgress)
      .where(
        and(eq(habitReadingProgress.userId, userId), eq(habitReadingProgress.habitId, habitId)),
      )
      .limit(1);

    return row ?? null;
  }

  private async getBooksHabit(userId: string, habitId: string): Promise<Habit> {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(
        and(eq(habits.id, habitId), eq(habits.userId, userId), eq(habits.isActive, true)),
      )
      .limit(1);

    if (!habit) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Habit not found");
    }

    if (habit.templateId !== "books") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Reading progress is only available for books habits",
      );
    }

    return habit;
  }

  private toResponse(row: typeof habitReadingProgress.$inferSelect): HabitReadingProgressResponse {
    return {
      book_id: row.bookId,
      pages_read: row.pagesRead,
      pages_credited_today: row.pagesCreditedToday,
      last_read_page: row.lastReadPage,
      timer_remaining_seconds: row.timerRemainingSeconds,
      timer_saved_date: row.timerSavedDate,
      reader_day_start_page: row.readerDayStartPage,
      reader_day_date: row.readerDayDate,
      last_checkin_date: row.lastCheckinDate,
      completed_at: row.completedAt?.toISOString() ?? null,
      page_count: getKnownBookPageCount(row.bookId),
    };
  }
}
