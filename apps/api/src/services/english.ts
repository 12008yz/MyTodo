import {
  canSkipThisWeek,
  computeNextEnglishDay,
  getUserLocalDate,
  type EnglishDayStatus,
} from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  resolveEnglishMinimumWatchSec,
  type PatchEnglishSettingsRequest,
} from "@mytodo/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  englishLessons,
  englishProgress,
  englishSettings,
  type EnglishLesson,
  type EnglishProgress,
  type EnglishSettings,
  type User,
} from "../db/schema/index.js";
import type { CheckinService } from "./checkins.js";

type FinalEnglishStatus = EnglishDayStatus | null;

export class EnglishService {
  constructor(
    private readonly db: Database,
    private readonly checkinService: CheckinService,
  ) {}

  async getToday(user: User) {
    const settings = await this.getSettings(user.id);

    if (!settings?.isEnabled) {
      return { enabled: false as const };
    }

    await this.ensureEnglishLessonCatalog();
    await this.checkinService.reconcileForeignLanguageMinutes(user);

    const lesson = await this.resolveActiveLesson(settings);
    const today = getUserLocalDate(new Date(), user.timezone);
    const progress = await this.getProgressForLesson(user.id, today, lesson.id);

    return this.buildTodayPayload(settings, lesson, progress);
  }

  async getCatalog(user: User) {
    const settings = await this.requireEnabledSettings(user.id);
    await this.ensureEnglishLessonCatalog();
    const today = getUserLocalDate(new Date(), user.timezone);

    const lessons = await this.db
      .select()
      .from(englishLessons)
      .orderBy(asc(englishLessons.dayNumber));

    const progressRows = await this.db
      .select()
      .from(englishProgress)
      .where(and(eq(englishProgress.userId, user.id), eq(englishProgress.date, today)));

    const progressByLesson = new Map(progressRows.map((row) => [row.lessonId, row]));

    return {
      current_day: settings.currentDay,
      selected_lesson_id: settings.selectedLessonId,
      lessons: lessons.map((lesson) => {
        const progress = progressByLesson.get(lesson.id);
        return {
          ...this.toLessonResponse(lesson),
          today_watched_sec: progress?.watchedSec ?? 0,
          today_status: this.toDayStatus(progress?.status),
        };
      }),
    };
  }

  async recordWatch(user: User, watchedSec: number) {
    const settings = await this.requireEnabledSettings(user.id);
    const lesson = await this.resolveActiveLesson(settings);
    const today = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.getProgressForLesson(user.id, today, lesson.id);

    if (existing?.status === "success" || existing?.status === "skipped" || existing?.status === "fail") {
      return {
        lesson_id: lesson.id,
        watched_sec: existing.watchedSec,
      };
    }

    const nextWatchedSec = Math.max(existing?.watchedSec ?? 0, watchedSec);

    if (existing) {
      await this.db
        .update(englishProgress)
        .set({
          watchedSec: nextWatchedSec,
          updatedAt: new Date(),
        })
        .where(eq(englishProgress.id, existing.id));
    } else {
      await this.db.insert(englishProgress).values({
        userId: user.id,
        lessonId: lesson.id,
        date: today,
        status: "pending",
        watchedSec: nextWatchedSec,
      });
    }

    return {
      lesson_id: lesson.id,
      watched_sec: nextWatchedSec,
    };
  }

  async selectLesson(user: User, lessonId: string) {
    const settings = await this.requireEnabledSettings(user.id);
    const previousLesson = await this.resolveActiveLesson(settings);
    const lesson = await this.requireLessonById(lessonId);
    const today = getUserLocalDate(new Date(), user.timezone);

    if (previousLesson.id !== lesson.id) {
      await this.checkinService.resetForeignLanguageCheckinForToday(user);
      await this.clearLessonProgressForToday(user.id, today, lesson.id);
    }

    await this.db
      .update(englishSettings)
      .set({ selectedLessonId: lesson.id })
      .where(eq(englishSettings.userId, user.id));

    const progress = await this.getProgressForLesson(user.id, today, lesson.id);
    const dayStatus = this.toDayStatus(progress?.status);

    return {
      selected_lesson_id: lesson.id,
      lesson: this.toLessonResponse(lesson),
      current_day: settings.currentDay,
      day_status: dayStatus,
      watched_sec: progress?.watchedSec ?? 0,
      preview_next_day: this.previewNextDay(
        settings.currentDay,
        this.coursePreviewStatus(settings.currentDay, lesson.dayNumber, dayStatus),
      ),
      habit_complete: dayStatus === "success",
    };
  }

  async complete(user: User, watchedSec: number) {
    const settings = await this.requireEnabledSettings(user.id);
    const lesson = await this.resolveActiveLesson(settings);
    const today = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.getProgressForLesson(user.id, today, lesson.id);

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

    const minimumWatchSec = resolveEnglishMinimumWatchSec(lesson.durationSec, watchedSec);

    if (watchedSec < minimumWatchSec) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        `watched_sec must be at least ${minimumWatchSec}`,
      );
    }

    const wasAlreadySuccess = existing?.status === "success";

    await this.saveLessonProgress(user.id, lesson.id, today, "success", watchedSec);

    if (!wasAlreadySuccess) {
      await this.checkinService.markForeignLanguageDayCompleteFromVideo(user);
    }

    return {
      current_day: settings.currentDay,
      day_status: "success" as const,
      watched_sec: watchedSec,
      preview_next_day:
        lesson.dayNumber === settings.currentDay
          ? computeNextEnglishDay(settings.currentDay, "success")
          : settings.currentDay,
    };
  }

  async skip(user: User) {
    const settings = await this.requireEnabledSettings(user.id);
    const lesson = await this.requireLessonForDay(settings.currentDay);
    const today = getUserLocalDate(new Date(), user.timezone);
    const existing = await this.getProgressForLesson(user.id, today, lesson.id);

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

    await this.saveLessonProgress(
      user.id,
      lesson.id,
      today,
      "skipped",
      existing?.watchedSec ?? 0,
    );

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

  private coursePreviewStatus(
    currentDay: number,
    lessonDayNumber: number,
    dayStatus: FinalEnglishStatus,
  ): FinalEnglishStatus {
    if (lessonDayNumber !== currentDay) {
      return null;
    }

    return dayStatus;
  }

  private buildTodayPayload(
    settings: EnglishSettings,
    lesson: EnglishLesson,
    progress: EnglishProgress | null,
  ) {
    const dayStatus = this.toDayStatus(progress?.status);

    return {
      enabled: true as const,
      current_day: settings.currentDay,
      lesson: this.toLessonResponse(lesson),
      selected_lesson_id: settings.selectedLessonId,
      day_status: dayStatus,
      watched_sec: progress?.watchedSec ?? 0,
      preview_next_day: this.previewNextDay(
        settings.currentDay,
        this.coursePreviewStatus(settings.currentDay, lesson.dayNumber, dayStatus),
      ),
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

  private async ensureEnglishLessonCatalog(): Promise<void> {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const [row] = await this.db.select({ id: englishLessons.id }).from(englishLessons).limit(1);
    if (row) {
      return;
    }

    const { seedEnglishLessons } = await import("./seed.js");
    await seedEnglishLessons(this.db);
  }

  private async clearLessonProgressForToday(
    userId: string,
    date: string,
    lessonId: string,
  ): Promise<void> {
    await this.db
      .delete(englishProgress)
      .where(
        and(
          eq(englishProgress.userId, userId),
          eq(englishProgress.date, date),
          eq(englishProgress.lessonId, lessonId),
        ),
      );
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

  private async resolveActiveLesson(settings: EnglishSettings): Promise<EnglishLesson> {
    if (settings.selectedLessonId) {
      const selected = await this.getLessonById(settings.selectedLessonId);
      if (selected) {
        return selected;
      }
    }

    return this.requireLessonForDay(settings.currentDay);
  }

  private async getLessonByDay(dayNumber: number): Promise<EnglishLesson | null> {
    const [lesson] = await this.db
      .select()
      .from(englishLessons)
      .where(eq(englishLessons.dayNumber, dayNumber))
      .limit(1);

    return lesson ?? null;
  }

  private async getLessonById(lessonId: string): Promise<EnglishLesson | null> {
    const [lesson] = await this.db
      .select()
      .from(englishLessons)
      .where(eq(englishLessons.id, lessonId))
      .limit(1);

    return lesson ?? null;
  }

  private async requireLessonById(lessonId: string): Promise<EnglishLesson> {
    const lesson = await this.getLessonById(lessonId);

    if (!lesson) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Lesson not found");
    }

    return lesson;
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

  private async getProgressForLesson(userId: string, date: string, lessonId: string) {
    const [progress] = await this.db
      .select()
      .from(englishProgress)
      .where(
        and(
          eq(englishProgress.userId, userId),
          eq(englishProgress.date, date),
          eq(englishProgress.lessonId, lessonId),
        ),
      )
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

  private async saveLessonProgress(
    userId: string,
    lessonId: string,
    date: string,
    status: "success" | "skipped",
    watchedSec: number,
  ) {
    const existing = await this.getProgressForLesson(userId, date, lessonId);

    if (existing) {
      await this.db
        .update(englishProgress)
        .set({
          status,
          watchedSec,
          updatedAt: new Date(),
        })
        .where(eq(englishProgress.id, existing.id));
      return;
    }

    await this.db
      .insert(englishProgress)
      .values({
        userId,
        lessonId,
        date,
        status,
        watchedSec,
      })
      .onConflictDoUpdate({
        target: [
          englishProgress.userId,
          englishProgress.date,
          englishProgress.lessonId,
        ],
        set: {
          status,
          watchedSec,
          updatedAt: new Date(),
        },
      });
  }
}
