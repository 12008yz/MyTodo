import { and, eq, inArray } from "drizzle-orm";
import { getUserLocalDate } from "@mytodo/domain";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  isKnownNutritionIngredientId,
  isKnownNutritionRecipeId,
  isNutritionHabit,
  type HabitNutritionLog,
  type PutNutritionTodayRequest,
} from "@mytodo/shared";
import type { DbExecutor } from "../db/index.js";
import { habitNutritionLogs, habits, type Habit, type User } from "../db/schema/index.js";

export class NutritionLogService {
  constructor(private readonly db: DbExecutor) {}

  async getTodayLog(user: User, habitId: string): Promise<HabitNutritionLog | null> {
    await this.getNutritionHabit(user.id, habitId);
    const today = getUserLocalDate(new Date(), user.timezone);
    const row = await this.findRow(user.id, habitId, today);
    return row ? this.toResponse(row) : null;
  }

  async upsertTodayLog(
    user: User,
    habitId: string,
    body: PutNutritionTodayRequest,
  ): Promise<HabitNutritionLog> {
    await this.getNutritionHabit(user.id, habitId);
    this.assertValidPayload(body);

    const today = getUserLocalDate(new Date(), user.timezone);
    const now = new Date();
    const ingredientIds = [...new Set(body.ingredient_ids)];
    const existing = await this.findRow(user.id, habitId, today);
    const recipeId =
      body.recipe_id !== undefined ? (body.recipe_id ?? null) : (existing?.recipeId ?? null);

    const [row] = await this.db
      .insert(habitNutritionLogs)
      .values({
        userId: user.id,
        habitId,
        date: today,
        ingredientIds,
        recipeId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [habitNutritionLogs.habitId, habitNutritionLogs.date],
        set: {
          ingredientIds,
          recipeId,
          updatedAt: now,
        },
      })
      .returning();

    return this.toResponse(row!);
  }

  async listForHabits(
    userId: string,
    habitIds: string[],
    date: string,
  ): Promise<Map<string, HabitNutritionLog>> {
    if (habitIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select()
      .from(habitNutritionLogs)
      .where(
        and(
          eq(habitNutritionLogs.userId, userId),
          eq(habitNutritionLogs.date, date),
          inArray(habitNutritionLogs.habitId, habitIds),
        ),
      );

    return new Map(rows.map((row) => [row.habitId, this.toResponse(row)]));
  }

  private assertValidPayload(body: PutNutritionTodayRequest): void {
    for (const id of body.ingredient_ids) {
      if (!isKnownNutritionIngredientId(id)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, `Unknown ingredient: ${id}`);
      }
    }

    if (body.recipe_id && !isKnownNutritionRecipeId(body.recipe_id)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, `Unknown recipe: ${body.recipe_id}`);
    }
  }

  private async getNutritionHabit(userId: string, habitId: string): Promise<Habit> {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId), eq(habits.isActive, true)))
      .limit(1);

    if (!habit || !isNutritionHabit({ category_key: habit.categoryKey, name: habit.name })) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Nutrition habit not found");
    }

    return habit;
  }

  private async findRow(userId: string, habitId: string, date: string) {
    const [row] = await this.db
      .select()
      .from(habitNutritionLogs)
      .where(
        and(
          eq(habitNutritionLogs.userId, userId),
          eq(habitNutritionLogs.habitId, habitId),
          eq(habitNutritionLogs.date, date),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  private toResponse(row: typeof habitNutritionLogs.$inferSelect): HabitNutritionLog {
    return {
      id: row.id,
      habit_id: row.habitId,
      date: row.date,
      ingredient_ids: row.ingredientIds,
      recipe_id: row.recipeId,
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
