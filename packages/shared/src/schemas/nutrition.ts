import { z } from "zod";
import { NUTRITION_MAX_INGREDIENTS, NUTRITION_MIN_INGREDIENTS } from "../nutrition/constants.js";

export const habitNutritionLogSchema = z.object({
  id: z.string().uuid(),
  habit_id: z.string().uuid(),
  date: z.string().date(),
  ingredient_ids: z.array(z.string().min(1)),
  recipe_id: z.string().min(1).nullable(),
  updated_at: z.string().datetime(),
});

export type HabitNutritionLog = z.infer<typeof habitNutritionLogSchema>;

export const putNutritionTodayRequestSchema = z.object({
  ingredient_ids: z
    .array(z.string().min(1))
    .min(NUTRITION_MIN_INGREDIENTS)
    .max(NUTRITION_MAX_INGREDIENTS),
  recipe_id: z.string().min(1).optional(),
});

export type PutNutritionTodayRequest = z.infer<typeof putNutritionTodayRequestSchema>;

export const nutritionTodayResponseSchema = z.object({
  log: habitNutritionLogSchema.nullable(),
});

export type NutritionTodayResponse = z.infer<typeof nutritionTodayResponseSchema>;
