import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  canEnableSilenceMode,
  scheduleTimezoneChange,
  SILENCE_MODE_DURATION_MS,
} from "@mytodo/domain";
import {
  ApiError,
  ACCESS_TOKEN_TTL_SEC,
  ERROR_CODES,
  HTTP_STATUS,
  REFRESH_TOKEN_TTL_DAYS,
  TRIAL_DAYS,
  computeDailyBudgetMin,
  resolveTimezone,
  type LoginRequest,
  type PatchMeRequest,
  type RegisterRequest,
} from "@mytodo/shared";
import type { Database } from "../db/index.js";
import {
  checkins,
  englishProgress,
  habits,
  refreshTokens,
  users,
  type User,
} from "../db/schema/index.js";
import {
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  verifyPassword,
} from "../lib/auth/crypto.js";
import { buildZipArchive, csvRow } from "../lib/export-zip.js";
import { applyPendingTimezoneIfDue } from "../lib/user-timezone.js";
import { toUserProfile } from "../lib/user-mapper.js";
import type { PledgeService } from "./pledges.js";

type AuthResult = {
  user: ReturnType<typeof toUserProfile>;
  accessToken: string;
  refreshToken: string;
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function hasCompletedOnboarding(user: User): boolean {
  return (
    user.weightKg !== null &&
    user.heightCm !== null &&
    user.freeTimeMin !== null &&
    user.wakeTime !== null &&
    user.sleepTime !== null
  );
}

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly signAccessToken: (payload: { sub: string }) => string,
  ) {}

  async register(input: RegisterRequest): Promise<AuthResult> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, "Email already registered");
    }

    const passwordHash = await hashPassword(input.password);

    const [user] = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        name: input.name,
        age: input.age,
        gender: input.gender,
        timezone: resolveTimezone(input.timezone),
        trialEndsAt: addDays(new Date(), TRIAL_DAYS),
      })
      .returning();

    if (!user) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to create user",
      );
    }

    const trialEndsAt = addDays(user.createdAt, TRIAL_DAYS);
    const [userWithTrial] = await this.db
      .update(users)
      .set({ trialEndsAt })
      .where(eq(users.id, user.id))
      .returning();

    if (!userWithTrial) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to create user",
      );
    }

    return this.issueTokens(userWithTrial);
  }

  async login(input: LoginRequest): Promise<AuthResult> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, "Invalid credentials");
    }

    const synced = await applyPendingTimezoneIfDue(this.db, user);
    return this.issueTokens(synced);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(refreshToken);

    return this.db.transaction(async (tx) => {
      const [stored] = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);

      if (!stored || stored.expiresAt <= new Date()) {
        throw new ApiError(
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED,
          "Invalid or expired refresh token",
        );
      }

      const [user] = await tx.select().from(users).where(eq(users.id, stored.userId)).limit(1);

      if (!user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, "User not found");
      }

      const synced = await applyPendingTimezoneIfDue(tx, user);

      const deleted = await tx
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, stored.id))
        .returning({ id: refreshTokens.id });

      if (deleted.length === 0) {
        throw new ApiError(
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED,
          "Invalid or expired refresh token",
        );
      }

      const accessToken = this.signAccessToken({ sub: synced.id });
      const newRefreshToken = generateRefreshToken();
      const expiresAt = addDays(new Date(), REFRESH_TOKEN_TTL_DAYS);

      await tx.insert(refreshTokens).values({
        userId: synced.id,
        tokenHash: hashRefreshToken(newRefreshToken),
        expiresAt,
      });

      return {
        user: toUserProfile(synced),
        accessToken,
        refreshToken: newRefreshToken,
      };
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const accessToken = this.signAccessToken({ sub: user.id });
    const refreshToken = generateRefreshToken();
    const expiresAt = addDays(new Date(), REFRESH_TOKEN_TTL_DAYS);

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    });

    return {
      user: toUserProfile(user),
      accessToken,
      refreshToken,
    };
  }
}

export class UserService {
  constructor(
    private readonly db: Database,
    private readonly pledgeService?: PledgeService,
  ) {}

  async getById(userId: string): Promise<User> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "User not found");
    }

    return applyPendingTimezoneIfDue(this.db, user);
  }

  async updateProfile(userId: string, patch: PatchMeRequest): Promise<User> {
    let current = await this.getById(userId);
    const now = new Date();

    if (patch.enable_silence_mode) {
      if (!canEnableSilenceMode(current.silenceModeUsedAt, now)) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Silence mode can only be enabled once every 30 days",
        );
      }

      const silenceModeUntil = new Date(now.getTime() + SILENCE_MODE_DURATION_MS);
      const [silenced] = await this.db
        .update(users)
        .set({
          silenceModeUntil,
          silenceModeUsedAt: now,
        })
        .where(eq(users.id, userId))
        .returning();

      if (!silenced) {
        throw new ApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.INTERNAL_ERROR,
          "Failed to enable silence mode",
        );
      }

      const otherFields = Object.keys(patch).filter((key) => key !== "enable_silence_mode");
      if (otherFields.length === 0) {
        return silenced;
      }

      current = silenced;
    }

    const updates: Partial<typeof users.$inferInsert> = {};

    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.weight_kg !== undefined) updates.weightKg = String(patch.weight_kg);
    if (patch.height_cm !== undefined) updates.heightCm = String(patch.height_cm);
    if (patch.free_time_min !== undefined) {
      updates.freeTimeMin = patch.free_time_min;
      updates.dailyBudgetMin = computeDailyBudgetMin(patch.free_time_min);
    }
    if (patch.wake_time !== undefined) updates.wakeTime = normalizeTime(patch.wake_time);
    if (patch.sleep_time !== undefined) updates.sleepTime = normalizeTime(patch.sleep_time);
    if (patch.pomodoro_work_min !== undefined) updates.pomodoroWorkMin = patch.pomodoro_work_min;
    if (patch.pomodoro_break_min !== undefined) updates.pomodoroBreakMin = patch.pomodoro_break_min;
    if (patch.pomodoro_long_break_min !== undefined) {
      updates.pomodoroLongBreakMin = patch.pomodoro_long_break_min;
    }
    if (patch.harshness_level !== undefined) updates.harshnessLevel = patch.harshness_level;

    if (patch.timezone !== undefined) {
      const resolved = resolveTimezone(patch.timezone);
      if (resolved === current.pendingTimezone) {
        // already scheduled
      } else if (resolved === current.timezone && !current.pendingTimezone) {
        // no change
      } else if (resolved === current.timezone && current.pendingTimezone) {
        updates.pendingTimezone = null;
        updates.pendingTimezoneFrom = null;
      } else {
        const scheduled = scheduleTimezoneChange(current.timezone, resolved, now);
        updates.pendingTimezone = scheduled.pendingTimezone;
        updates.pendingTimezoneFrom = scheduled.pendingTimezoneFrom;
      }
    }

    const merged: User = {
      ...current,
      ...updates,
      weightKg: updates.weightKg ?? current.weightKg,
      heightCm: updates.heightCm ?? current.heightCm,
      freeTimeMin: updates.freeTimeMin ?? current.freeTimeMin,
      wakeTime: updates.wakeTime ?? current.wakeTime,
      sleepTime: updates.sleepTime ?? current.sleepTime,
    };

    if (hasCompletedOnboarding(merged)) {
      updates.onboardingCompleted = true;
    }

    if (Object.keys(updates).length === 0) {
      return current;
    }

    const [user] = await this.db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to update user",
      );
    }

    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.getById(userId);
    await this.pledgeService?.failAllActiveForUser(userId);
    await this.db.delete(users).where(eq(users.id, userId));
  }

  async buildExportArchive(userId: string): Promise<Buffer> {
    const user = await this.getById(userId);
    const profile = toUserProfile(user);

    const habitRows = await this.db.select().from(habits).where(eq(habits.userId, userId));
    const habitIds = habitRows.map((row) => row.id);

    const checkinRows =
      habitIds.length === 0
        ? []
        : await this.db.select().from(checkins).where(inArray(checkins.habitId, habitIds));

    const progressRows = await this.db
      .select()
      .from(englishProgress)
      .where(eq(englishProgress.userId, userId));

    const habitsCsv = [
      csvRow([
        "id",
        "template_id",
        "side",
        "type",
        "unit",
        "current_goal",
        "growth_step",
        "progression_direction",
        "phase",
        "is_active",
        "created_at",
      ]),
      ...habitRows.map((row) =>
        csvRow([
          row.id,
          row.templateId,
          row.side,
          row.type,
          row.unit,
          row.currentGoal,
          row.growthStep,
          row.progressionDirection,
          row.phase,
          row.isActive,
          row.createdAt.toISOString(),
        ]),
      ),
    ].join("\n");

    const checkinsCsv = [
      csvRow(["date", "habit_id", "status", "value", "updated_at"]),
      ...checkinRows.map((row) =>
        csvRow([row.date, row.habitId, row.status, row.value, row.updatedAt.toISOString()]),
      ),
    ].join("\n");

    const englishCsv = [
      csvRow(["date", "status", "watched_sec", "lesson_id"]),
      ...progressRows.map((row) =>
        csvRow([row.date, row.status, row.watchedSec, row.lessonId]),
      ),
    ].join("\n");

    return buildZipArchive({
      "profile.json": JSON.stringify(profile, null, 2),
      "habits.csv": habitsCsv,
      "checkins.csv": checkinsCsv,
      "english_progress.csv": englishCsv,
    });
  }
}

export function createAuthServices(
  app: FastifyInstance,
  db: Database,
  pledgeService?: PledgeService,
) {
  const signAccessToken = (payload: { sub: string }) =>
    app.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL_SEC });

  return {
    authService: new AuthService(db, signAccessToken),
    userService: new UserService(db, pledgeService),
  };
}
