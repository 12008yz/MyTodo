import { and, eq } from "drizzle-orm";
import {
  computeAbstinenceElapsed,
  effectiveHarshnessLevel,
  getUserLocalDate,
  isSilenceModeActive,
} from "@mytodo/domain";
import {
  ApiError,
  COACH_DAILY_MESSAGE_LIMIT,
  ERROR_CODES,
  HTTP_STATUS,
  isCoachEligibleDarkHabit,
  resolveDarkCoachReply,
  type CoachChatRequest,
  type HabitUnit,
  type HarshnessLevel,
} from "@mytodo/shared";
import type { Redis } from "ioredis";
import type { DbExecutor } from "../db/index.js";
import { habits, type Habit, type User } from "../db/schema/index.js";
import {
  buildCoachSystemPrompt,
  createGigaChatClient,
  type GigaChatClient,
} from "../lib/gigachat/client.js";

const UNIT_LABELS: Record<HabitUnit, string> = {
  pages: "стр.",
  minutes: "мин",
  reps: "повт.",
  seconds: "сек",
  cigarettes: "сиг.",
  spoons: "лож.",
  pieces: "шт.",
  lessons: "урок.",
};

function formatUnit(unit: string | null): string {
  if (!unit) return "";
  return UNIT_LABELS[unit as HabitUnit] ?? unit;
}

function coachLimitKey(userId: string, localDate: string): string {
  return `coach:limit:${userId}:${localDate}`;
}

export class CoachService {
  private readonly memoryLimits = new Map<string, number>();

  constructor(
    private readonly db: DbExecutor,
    private readonly redis: Redis | null,
    private readonly gigaChat: GigaChatClient | null,
  ) {}

  async chat(user: User, input: CoachChatRequest): Promise<{
    reply: string;
    messages_left: number;
    source: "gigachat" | "template";
  }> {
    const habit = await this.getDarkHabit(user.id, input.habit_id);
    const localDate = getUserLocalDate(new Date(), user.timezone);
    const used = await this.getUsageCount(user.id, localDate);

    if (used >= COACH_DAILY_MESSAGE_LIMIT) {
      throw new ApiError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        ERROR_CODES.RATE_LIMITED,
        `Лимит сообщений на сегодня (${COACH_DAILY_MESSAGE_LIMIT}) исчерпан`,
      );
    }

    const harshness = effectiveHarshnessLevel(
      user.harshnessLevel,
      user.silenceModeUntil,
      new Date(),
    ) as HarshnessLevel;

    const context = this.buildContext(habit, harshness);
    let reply: string;
    let source: "gigachat" | "template" = "template";

    if (this.gigaChat && !isSilenceModeActive(user.silenceModeUntil, new Date())) {
      try {
        reply = await this.gigaChat.complete([
          { role: "system", content: context.systemPrompt },
          { role: "user", content: input.message },
        ]);
        source = "gigachat";
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[coach] GigaChat failed, using template:", error);
        }
        reply = resolveDarkCoachReply(habit.templateId, harshness, input.message);
      }
    } else {
      reply = resolveDarkCoachReply(habit.templateId, harshness, input.message);
    }

    await this.incrementUsage(user.id, localDate);
    const messagesLeft = Math.max(0, COACH_DAILY_MESSAGE_LIMIT - used - 1);

    return { reply, messages_left: messagesLeft, source };
  }

  private buildContext(habit: Habit, harshness: HarshnessLevel) {
    const unitLabel = formatUnit(habit.unit);
    let timerLabel: string | null = null;

    if (habit.type === "abstinence" && habit.lastRelapseAt) {
      const elapsed = computeAbstinenceElapsed(habit.lastRelapseAt, new Date());
      timerLabel = `${elapsed.days} д ${elapsed.hours} ч ${elapsed.minutes} мин`;
    }

    const systemPrompt = buildCoachSystemPrompt({
      habitName: habit.name,
      habitType: habit.type as "limit" | "abstinence",
      currentGoal: Number(habit.currentGoal),
      unitLabel,
      successDaysAtGoal: habit.successDaysAtGoal,
      progressionIntervalDays: habit.progressionIntervalDays,
      harshnessLevel: harshness,
      timerLabel,
    });

    return { systemPrompt };
  }

  private async getDarkHabit(userId: string, habitId: string): Promise<Habit> {
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

    if (habit.side !== "dark") {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Coach is only available for dark-side habits",
      );
    }

    if (!isCoachEligibleDarkHabit(habit.templateId)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Coach is not available for this habit",
      );
    }

    return habit;
  }

  private async getUsageCount(userId: string, localDate: string): Promise<number> {
    const key = coachLimitKey(userId, localDate);
    if (this.redis) {
      const value = await this.redis.get(key);
      return value ? Number(value) : 0;
    }
    return this.memoryLimits.get(key) ?? 0;
  }

  private async incrementUsage(userId: string, localDate: string): Promise<void> {
    const key = coachLimitKey(userId, localDate);
    if (this.redis) {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, 60 * 60 * 48);
      }
      return;
    }
    this.memoryLimits.set(key, (this.memoryLimits.get(key) ?? 0) + 1);
  }
}

export function resolveCoachGigaChatClient(
  credentials: string | undefined,
): GigaChatClient | null {
  if (!credentials?.trim()) {
    return null;
  }
  return createGigaChatClient(credentials.trim());
}
