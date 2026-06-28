import {
  canSkipThisWeek,
  computeNextEnglishDay,
  getUserLocalDate,
  type EnglishDayStatus,
} from "@mytodo/domain";
import {
  ApiError,
  ENGLISH_WATCH_THRESHOLD,
  ERROR_CODES,
  HTTP_STATUS,
  type PatchEnglishSettingsRequest,
} from "@mytodo/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  englishLessons,
  englishProgress,
  englishSettings,
  type EnglishLesson,
  type EnglishSettings,
  type User,
} from "../db/schema/index.js";

type FinalEnglishStatus = EnglishDayStatus | null;

export class EnglishService {
  constructor(private readonly db: Database) {}

  async getToday(user: User) {
    const settings = await this.getSettings(user.id);

    if (!settings?.isEnabled) {
      return { enabled: false as const };
    }

    const lesson = await this.getLessonByDay(settings.currentDay);

    if (!lesson) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "Lesson for current day not found",
      );
    }

    const today = getUserLocalDate(new Date(), user.timezone);
    const progress = await this.getProgressForDate(user.id, today);

    return {
      enabled: true as const,
      current_day: settings.currentDay,
      lesson: this.toLessonResponse(lesson),
      day_status: this.toDayStatus(progress?.status),
      watched_sec: progress?.watchedSec ?? 0,
      preview_next_day: this.previewNextDay(settings.currentDay, this.toDayStatus(progress?.status)),
    };
  }

  async complete(user: User, watchedSec: number) {
    const settings = await this.requireEnabledSettings(user.id);
    const lesson = await this.requireLessonForDay(settings.currentDay);
    const today = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.getProgressForDate(user.id, today);

    if (existing?.status === "skipped") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot complete a skipped day",
      );
    }

    if (existing?.status === "fail") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot complete a failed day",
      );
    }

    const minimumWatchSec =
      lesson.durationSec <= 60
        ? Math.max(600, Math.floor(watchedSec * 0.95))
        : Math.ceil(lesson.durationSec * ENGLISH_WATCH_THRESHOLD);

    if (watchedSec < minimumWatchSec) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        `watched_sec must be at least ${minimumWatchSec}`,
      );
    }

    await this.saveProgress(user.id, lesson.id, today, "success", watchedSec);

    return {
      current_day: settings.currentDay,
      day_status: "success" as const,
      watched_sec: watchedSec,
      preview_next_day: computeNextEnglishDay(settings.currentDay, "success"),
    };
  }

  async skip(user: User) {
    const settings = await this.requireEnabledSettings(user.id);
    const lesson = await this.requireLessonForDay(settings.currentDay);
    const today = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.getProgressForDate(user.id, today);

    if (existing?.status === "success") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot skip after completing today's lesson",
      );
    }

    if (existing?.status !== "skipped") {
      const skippedDates = (await this.listSkippedDates(user.id)).filter((skipDate) => skipDate !== today);

      if (!canSkipThisWeek(skippedDates, today)) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Maximum 2 skips per calendar week allowed",
        );
      }
    }

    await this.saveProgress(user.id, lesson.id, today, "skipped", existing?.watchedSec ?? 0);

    return {
      current_day: settings.currentDay,
      day_status: "skipped" as const,
      preview_next_day: computeNextEnglishDay(settings.currentDay, "skipped"),
    };
  }

  async getHistory(user: User) {
    await this.requireEnabledSettings(user.id);

    const rows = await this.db
      .select({
        progress: englishProgress,
        lesson: englishLessons,
      })
      .from(englishProgress)
      .leftJoin(englishLessons, eq(englishProgress.lessonId, englishLessons.id))
      .where(and(eq(englishProgress.userId, user.id), eq(englishProgress.status, "success")))
      .orderBy(desc(englishProgress.date));

    return {
      items: rows.map(({ progress, lesson }) => ({
        date: progress.date,
        status: progress.status as "success",
        watched_sec: progress.watchedSec,
        lesson: lesson ? this.toLessonResponse(lesson) : null,
      })),
    };
  }

  async updateSettings(user: User, body: PatchEnglishSettingsRequest) {
    const today = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.getSettings(user.id);

    if (body.is_enabled) {
      if (existing) {
        await this.db
          .update(englishSettings)
          .set({ isEnabled: true })
          .where(eq(englishSettings.userId, user.id));
      } else {
        await this.db.insert(englishSettings).values({
          userId: user.id,
          isEnabled: true,
          currentDay: 1,
          startedAt: today,
        });
      }
    } else if (existing) {
      await this.db
        .update(englishSettings)
        .set({ isEnabled: false })
        .where(eq(englishSettings.userId, user.id));
    } else {
      await this.db.insert(englishSettings).values({
        userId: user.id,
        isEnabled: false,
        currentDay: 1,
      });
    }

    const settings = await this.getSettings(user.id);

    return {
      is_enabled: settings!.isEnabled,
      current_day: settings!.currentDay,
      started_at: settings!.startedAt,
    };
  }

  private previewNextDay(currentDay: number, dayStatus: FinalEnglishStatus): number {
    if (dayStatus === "success" || dayStatus === "fail" || dayStatus === "skipped") {
      return computeNextEnglishDay(currentDay, dayStatus);
    }

    return currentDay;
  }

  private toDayStatus(status?: string | null): FinalEnglishStatus {
    if (status === "success" || status === "fail" || status === "skipped") {
      return status;
    }

    return null;
  }

  private toLessonResponse(lesson: EnglishLesson) {
    return {
      id: lesson.id,
      day_number: lesson.dayNumber,
      title: lesson.title,
      video_url: lesson.videoUrl,
      duration_sec: lesson.durationSec,
      description: lesson.description,
    };
  }

  private async getSettings(userId: string): Promise<EnglishSettings | null> {
    const [settings] = await this.db
      .select()
      .from(englishSettings)
      .where(eq(englishSettings.userId, userId))
      .limit(1);

    return settings ?? null;
  }

  private async requireEnabledSettings(userId: string): Promise<EnglishSettings> {
    const settings = await this.getSettings(userId);

    if (!settings?.isEnabled) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "English module is disabled",
      );
    }

    return settings;
  }

  private async getLessonByDay(dayNumber: number): Promise<EnglishLesson | null> {
    const [lesson] = await this.db
      .select()
      .from(englishLessons)
      .where(eq(englishLessons.dayNumber, dayNumber))
      .limit(1);

    return lesson ?? null;
  }

  private async requireLessonForDay(dayNumber: number): Promise<EnglishLesson> {
    const lesson = await this.getLessonByDay(dayNumber);

    if (!lesson) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "Lesson for current day not found",
      );
    }

    return lesson;
  }

  private async getProgressForDate(userId: string, date: string) {
    const [progress] = await this.db
      .select()
      .from(englishProgress)
      .where(and(eq(englishProgress.userId, userId), eq(englishProgress.date, date)))
      .limit(1);

    return progress ?? null;
  }

  private async listSkippedDates(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ date: englishProgress.date })
      .from(englishProgress)
      .where(and(eq(englishProgress.userId, userId), eq(englishProgress.status, "skipped")))
      .orderBy(asc(englishProgress.date));

    return rows.map((row) => row.date);
  }

  private async saveProgress(
    userId: string,
    lessonId: string,
    date: string,
    status: "success" | "skipped",
    watchedSec: number,
  ) {
    const existing = await this.getProgressForDate(userId, date);

    if (existing) {
      await this.db
        .update(englishProgress)
        .set({
          lessonId,
          status,
          watchedSec,
          updatedAt: new Date(),
        })
        .where(eq(englishProgress.id, existing.id));
      return;
    }

    await this.db.insert(englishProgress).values({
      userId,
      lessonId,
      date,
      status,
      watchedSec,
    });
  }
}
