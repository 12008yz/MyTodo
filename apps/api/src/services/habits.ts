import { and, asc, count, eq } from "drizzle-orm";
import { calibrateHabit, distributeGoalsAcrossBudget } from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HABIT_TEMPLATES,
  HTTP_STATUS,
  MAX_ACTIVE_HABITS,
  maxLightHabitsForBudget,
  type CreateHabitRequest,
  type HabitTemplateId,
  type HabitUnit,
  type PatchHabitRequest,
} from "@mytodo/shared";
import type { Database } from "../db/index.js";
import { habits, users, type User } from "../db/schema/index.js";
import { toHabitResponse } from "../lib/habit-mapper.js";

function toProfile(user: User) {
  if (user.weightKg === null || user.heightCm === null) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      "Complete onboarding before creating habits",
    );
  }

  return {
    dailyBudgetMin: user.dailyBudgetMin,
    age: user.age,
    gender: user.gender as "male" | "female" | "other",
    weightKg: Number(user.weightKg),
    heightCm: Number(user.heightCm),
  };
}

function isTemplateRequest(
  body: CreateHabitRequest,
): body is { template_id: HabitTemplateId; baseline_value?: number; icon?: string } {
  return "template_id" in body;
}

function willCreateLightHabit(body: CreateHabitRequest): boolean {
  if (isTemplateRequest(body)) {
    return HABIT_TEMPLATES[body.template_id].side === "light";
  }

  return true;
}

export class HabitService {
  constructor(private readonly db: Database) {}

  async list(userId: string, side?: "light" | "dark") {
    const conditions = [eq(habits.userId, userId), eq(habits.isActive, true)];
    if (side) {
      conditions.push(eq(habits.side, side));
    }

    const rows = await this.db
      .select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(asc(habits.createdAt));

    return rows.map(toHabitResponse);
  }

  async create(user: User, body: CreateHabitRequest) {
    this.assertOnboardingCompleted(user);

    const activeCount = await this.countActiveHabits(user.id);
    if (activeCount >= MAX_ACTIVE_HABITS) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        `Maximum ${MAX_ACTIVE_HABITS} active habits allowed`,
      );
    }

    const activeLightCount = await this.countActiveLightHabits(user.id);

    if (willCreateLightHabit(body)) {
      const maxLight = maxLightHabitsForBudget(user.freeTimeMin ?? 0);
      if (activeLightCount >= maxLight) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Слишком много полезных привычек для выбранного времени",
        );
      }
    }

    const calibrated = isTemplateRequest(body)
      ? this.calibrateFromTemplate(body, user, activeLightCount)
      : this.calibrateCustom(body, user, activeLightCount);

    const [habit] = await this.db
      .insert(habits)
      .values({
        userId: user.id,
        name: calibrated.name,
        type: calibrated.type,
        side: calibrated.side,
        unit: calibrated.unit,
        baselineValue: String(calibrated.baselineValue),
        currentGoal: String(calibrated.currentGoal),
        growthStep: String(calibrated.growthStep),
        progressionDirection: calibrated.progressionDirection,
        phase: calibrated.phase,
        lastRelapseAt: calibrated.lastRelapseAt,
        allowsWeeklySkip: calibrated.allowsWeeklySkip,
        isCustom: calibrated.isCustom,
        icon: calibrated.icon,
        templateId: calibrated.templateId,
        harshnessLevel: user.harshnessLevel,
      })
      .returning();

    if (!habit) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to create habit",
      );
    }

    if (calibrated.side === "light") {
      await this.recalibrateActiveLightGoals(user);
      const [refreshed] = await this.db
        .select()
        .from(habits)
        .where(eq(habits.id, habit.id))
        .limit(1);

      return toHabitResponse(refreshed ?? habit);
    }

    return toHabitResponse(habit);
  }

  async update(userId: string, habitId: string, body: PatchHabitRequest) {
    const habit = await this.getOwnedHabit(userId, habitId);

    const updates: Partial<typeof habits.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.current_goal !== undefined) {
      this.assertGoalPatchAllowed(habit, body.current_goal);
      updates.currentGoal = String(body.current_goal);
    }
    if (body.icon !== undefined) updates.icon = body.icon;

    const [updated] = await this.db
      .update(habits)
      .set(updates)
      .where(eq(habits.id, habit.id))
      .returning();

    if (!updated) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to update habit",
      );
    }

    return toHabitResponse(updated);
  }

  async deactivate(userId: string, habitId: string) {
    const habit = await this.getOwnedHabit(userId, habitId);
    const wasLight = habit.side === "light";

    const [updated] = await this.db
      .update(habits)
      .set({ isActive: false })
      .where(eq(habits.id, habit.id))
      .returning();

    if (!updated) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to deactivate habit",
      );
    }

    if (wasLight) {
      const user = await this.getUser(userId);
      await this.recalibrateActiveLightGoals(user);
    }

    return toHabitResponse(updated);
  }

  private assertGoalPatchAllowed(habit: typeof habits.$inferSelect, goal: number) {
    const isAbstinenceGoalLocked =
      habit.type === "abstinence" || habit.phase === "abstinence";

    if (isAbstinenceGoalLocked && goal !== 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Abstinence habits must keep current_goal at 0",
      );
    }
  }

  private async getUser(userId: string): Promise<User> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "User not found");
    }

    return user;
  }

  private assertOnboardingCompleted(user: User) {
    if (!user.onboardingCompleted) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Complete onboarding before creating habits",
      );
    }
  }

  private calibrateFromTemplate(
    body: { template_id: HabitTemplateId; baseline_value?: number; icon?: string },
    user: User,
    activeLightCount: number,
  ) {
    const template = HABIT_TEMPLATES[body.template_id];

    let baselineValue: number;
    if (body.template_id === "nail_biting") {
      baselineValue = 0;
    } else if (template.side === "light") {
      baselineValue = body.baseline_value ?? 0;
    } else if (body.baseline_value === undefined) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "baseline_value is required for this habit template",
      );
    } else {
      baselineValue = body.baseline_value;
    }

    const activeLightHabitsIncludingNew =
      template.side === "light" ? activeLightCount + 1 : activeLightCount || 1;

    const calibrated = calibrateHabit({
      kind: "template",
      templateId: body.template_id,
      template,
      baselineValue,
      profile: toProfile(user),
      activeLightHabitsIncludingNew,
    });

    if (body.icon) {
      calibrated.icon = body.icon;
    }

    return calibrated;
  }

  private calibrateCustom(
    body: { name: string; unit: "minutes" | "pages" | "reps" | "lessons"; baseline_value: number; icon?: string },
    user: User,
    activeLightCount: number,
  ) {
    return calibrateHabit({
      kind: "custom",
      name: body.name,
      unit: body.unit,
      baselineValue: body.baseline_value,
      profile: toProfile(user),
      activeLightHabitsIncludingNew: activeLightCount + 1,
      icon: body.icon,
    });
  }

  private async recalibrateActiveLightGoals(user: User): Promise<void> {
    const lightHabits = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, user.id), eq(habits.isActive, true), eq(habits.side, "light")));

    const profile = toProfile(user);
    const goals = distributeGoalsAcrossBudget(
      lightHabits.map((habit) => ({
        id: habit.id,
        habit: {
          name: habit.name,
          unit: (habit.unit ?? "minutes") as HabitUnit,
          templateId: habit.templateId as HabitTemplateId | null,
        },
        baselineValue: Number(habit.baselineValue),
      })),
      profile,
    );

    await Promise.all(
      lightHabits.map(async (habit) => {
        const newGoal = goals.get(habit.id);
        if (newGoal === undefined || Number(habit.currentGoal) === newGoal) {
          return;
        }

        await this.db
          .update(habits)
          .set({ currentGoal: String(newGoal) })
          .where(eq(habits.id, habit.id));
      }),
    );
  }

  private async countActiveHabits(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.isActive, true)));

    return Number(row?.value ?? 0);
  }

  private async countActiveLightHabits(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.isActive, true), eq(habits.side, "light")));

    return Number(row?.value ?? 0);
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
}
