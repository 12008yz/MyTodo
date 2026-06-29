import {
  closeDayForHabit,
  closeEnglishDay,
  getUserLocalDate,
  isDayCloseMinute,
  type HabitForDayClose,
} from "@mytodo/domain";
import { SOCIAL_MEDIA_MIN_GOAL, isCompanionLightHabit, isEarlyRiseCategoryKey } from "@mytodo/shared";
import { and, eq } from "drizzle-orm";
import type { Database, DbExecutor } from "../db/index.js";
import { isWeekendDate } from "@mytodo/domain";
import {
  checkins,
  dailyStats,
  englishLessons,
  englishProgress,
  englishSettings,
  goalSnapshots,
  habits,
  pomodoroSessions,
  users,
  type Habit,
  type User,
} from "../db/schema/index.js";
import type { DoomScrollService } from "./doom-scroll.js";
import { applyPendingTimezoneIfDue } from "../lib/user-timezone.js";
import { isWarmupDayForUser } from "../lib/warmup.js";
import type { PledgeService } from "./pledges.js";

export type DayCloseSummary = {
  user_id: string;
  date: string;
  habits_closed: number;
  english_closed: boolean;
};

export class DayCloseService {
  constructor(
    private readonly db: DbExecutor,
    private readonly doomScrollService: DoomScrollService,
    private readonly pledgeService?: PledgeService,
  ) {}

  /** Users whose local time is 23:59 at the given instant. */
  async findUsersToClose(now: Date = new Date()): Promise<User[]> {
    const allUsers = await this.db.select().from(users);
    const ready: User[] = [];

    for (const row of allUsers) {
      const user = await applyPendingTimezoneIfDue(this.db, row, now);
      if (isDayCloseMinute(now, user.timezone)) {
        ready.push(user);
      }
    }

    return ready;
  }

  async runMinuteTick(now: Date = new Date()): Promise<DayCloseSummary[]> {
    await this.doomScrollService.finalizeExpiredSessionsUpTo(now);

    const usersToClose = await this.findUsersToClose(now);
    const summaries: DayCloseSummary[] = [];

    for (const user of usersToClose) {
      const date = getUserLocalDate(now, user.timezone);
      summaries.push(await this.closeDayForUser(user, date, now));
    }

    return summaries;
  }

  async closeDayForUser(user: User, date: string, now: Date = new Date()): Promise<DayCloseSummary> {
    const silenceMode = user.silenceModeUntil != null && user.silenceModeUntil > now;
    const pledgeHabitIds = await this.listActivePledgeHabitIds(user.id);
    const activeHabits = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, user.id), eq(habits.isActive, true)));

    let habitsClosed = 0;

    for (const habit of activeHabits) {
      const closed = await this.closeHabitDay(user, habit, date, {
        silenceMode,
        hasActivePledge: pledgeHabitIds.has(habit.id),
      });

      if (closed) {
        habitsClosed += 1;
      }
    }

    const englishClosed = await this.closeEnglishDayForUser(user, date);

    return {
      user_id: user.id,
      date,
      habits_closed: habitsClosed,
      english_closed: englishClosed,
    };
  }

  private async closeHabitDay(
    user: User,
    habit: Habit,
    date: string,
    options: { silenceMode: boolean; hasActivePledge: boolean },
  ): Promise<boolean> {
    if (isWarmupDayForUser(user, date)) {
      return false;
    }

    if (isCompanionLightHabit({ category_key: habit.categoryKey, name: habit.name })) {
      return false;
    }

    const run = async (executor: DbExecutor): Promise<boolean> => {
      const [existingStat] = await executor
        .select()
        .from(dailyStats)
        .where(and(eq(dailyStats.habitId, habit.id), eq(dailyStats.date, date)))
        .limit(1);

      if (existingStat) {
        return false;
      }

      const [checkin] = await executor
        .select()
        .from(checkins)
        .where(and(eq(checkins.habitId, habit.id), eq(checkins.date, date)))
        .limit(1);

      const checkinForClose =
        isEarlyRiseCategoryKey(habit.categoryKey) &&
        isWeekendDate(date) &&
        (!checkin || checkin.status === "pending")
          ? { status: "skipped" as const, value: null }
          : checkin
            ? { status: checkin.status, value: checkin.value == null ? null : Number(checkin.value) }
            : null;

      const goalBeforeClose = Number(habit.currentGoal);
      const result = closeDayForHabit(
        this.toDayCloseHabit(habit),
        checkinForClose,
        {
          silenceMode: options.silenceMode,
          hasActivePledge: options.hasActivePledge,
        },
      );

      const minutesTotal = await this.sumPomodoroMinutes(
        habit.id,
        date,
        user.timezone,
        executor,
      );

      const [insertedStat] = await executor
        .insert(dailyStats)
        .values({
          habitId: habit.id,
          date,
          status: result.status,
          value: result.value == null ? null : String(result.value),
          minutesTotal,
        })
        .onConflictDoNothing()
        .returning();

      if (!insertedStat) {
        return false;
      }

      const weekendEarlyRiseSkip =
        isEarlyRiseCategoryKey(habit.categoryKey) &&
        isWeekendDate(date) &&
        result.status === "skipped" &&
        (!checkin || checkin.status === "pending");

      if (weekendEarlyRiseSkip) {
        if (checkin) {
          await executor
            .update(checkins)
            .set({
              status: "skipped",
              value: null,
              updatedAt: new Date(),
            })
            .where(eq(checkins.id, checkin.id));
        } else {
          await executor.insert(checkins).values({
            habitId: habit.id,
            date,
            status: "skipped",
            value: null,
          });
        }
      } else if (result.upsertCheckin) {
        if (checkin) {
          await executor
            .update(checkins)
            .set({
              status: result.status,
              value: result.value == null ? null : String(result.value),
              updatedAt: new Date(),
            })
            .where(eq(checkins.id, checkin.id));
        } else {
          await executor.insert(checkins).values({
            habitId: habit.id,
            date,
            status: result.status,
            value: result.value == null ? null : String(result.value),
          });
        }
      }

      await executor
        .insert(goalSnapshots)
        .values({
          habitId: habit.id,
          date,
          goalValue: String(goalBeforeClose),
        })
        .onConflictDoNothing();

      const habitUpdate: Partial<typeof habits.$inferInsert> = {
        currentGoal: String(result.nextGoal),
        successDaysAtGoal: result.nextSuccessDaysAtGoal,
      };

      if (result.nextBaselineValue !== undefined) {
        habitUpdate.baselineValue = String(result.nextBaselineValue);
      }

      if (result.nextPhase) {
        habitUpdate.phase = result.nextPhase;
      }

      if (result.setLastRelapseAt) {
        habitUpdate.lastRelapseAt = new Date();
      }

      await executor.update(habits).set(habitUpdate).where(eq(habits.id, habit.id));

      if (result.status === "fail") {
        await this.pledgeService?.failActivePledgeForHabit(habit.id, executor);
      }

      return true;
    };

    if ("transaction" in this.db) {
      return (this.db as Database).transaction(run);
    }

    return run(this.db);
  }

  private async closeEnglishDayForUser(user: User, date: string): Promise<boolean> {
    if (isWarmupDayForUser(user, date)) {
      return false;
    }

    const [settings] = await this.db
      .select()
      .from(englishSettings)
      .where(eq(englishSettings.userId, user.id))
      .limit(1);

    if (!settings?.isEnabled) {
      return false;
    }

    const run = async (executor: DbExecutor): Promise<boolean> => {
      const scheduledLesson = await this.getScheduledLesson(settings.currentDay, executor);

      const progress = scheduledLesson
        ? await this.getProgressForScheduledLesson(user.id, date, scheduledLesson.id, executor)
        : null;

      const lessonDay = scheduledLesson?.dayNumber ?? settings.currentDay;

      const { status, nextDay } = closeEnglishDay(
        lessonDay,
        progress ? { status: progress.status } : null,
      );

      if (progress && progress.status === status && settings.currentDay === nextDay) {
        return false;
      }

      if (progress) {
        await executor
          .update(englishProgress)
          .set({ status, updatedAt: new Date() })
          .where(eq(englishProgress.id, progress.id));
      } else if (scheduledLesson) {
        await executor.insert(englishProgress).values({
          userId: user.id,
          lessonId: scheduledLesson.id,
          date,
          status,
          watchedSec: 0,
        });
      }

      if (nextDay !== settings.currentDay) {
        await executor
          .update(englishSettings)
          .set({ currentDay: nextDay, selectedLessonId: null })
          .where(eq(englishSettings.userId, user.id));
      }

      return true;
    };

    if ("transaction" in this.db) {
      return (this.db as Database).transaction(run);
    }

    return run(this.db);
  }

  private async getScheduledLesson(currentDay: number, executor: DbExecutor = this.db) {
    const [lesson] = await executor
      .select()
      .from(englishLessons)
      .where(eq(englishLessons.dayNumber, currentDay))
      .limit(1);

    return lesson ?? null;
  }

  private async getProgressForScheduledLesson(
    userId: string,
    date: string,
    lessonId: string,
    executor: DbExecutor = this.db,
  ) {
    const [progress] = await executor
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

  private async sumPomodoroMinutes(
    habitId: string,
    date: string,
    timezone: string,
    executor: DbExecutor = this.db,
  ): Promise<number> {
    const rows = await executor
      .select({ workMin: pomodoroSessions.workMin, startedAt: pomodoroSessions.startedAt })
      .from(pomodoroSessions)
      .where(and(eq(pomodoroSessions.habitId, habitId), eq(pomodoroSessions.completed, true)));

    return rows
      .filter((row) => getUserLocalDate(row.startedAt, timezone) === date)
      .reduce((sum, row) => sum + row.workMin, 0);
  }

  private toDayCloseHabit(habit: Habit): HabitForDayClose {
    return {
      type: habit.type as HabitForDayClose["type"],
      side: habit.side as HabitForDayClose["side"],
      currentGoal: Number(habit.currentGoal),
      growthStep: Number(habit.growthStep),
      progressionDirection: habit.progressionDirection as HabitForDayClose["progressionDirection"],
      progressionIntervalDays: habit.progressionIntervalDays,
      successDaysAtGoal: habit.successDaysAtGoal,
      categoryKey: habit.categoryKey,
      name: habit.name,
      baselineValue: Number(habit.baselineValue),
      phase: habit.phase,
      templateId: habit.templateId,
      minGoal: habit.templateId === "social_media" ? SOCIAL_MEDIA_MIN_GOAL : undefined,
    };
  }

  private async listActivePledgeHabitIds(userId: string): Promise<Set<string>> {
    if (this.pledgeService) {
      return this.pledgeService.listActiveHabitIds(userId);
    }
    return new Set();
  }
}
