import type { NutritionMeal, NutritionRecipe } from "./types.js";
import { NUTRITION_RECIPES } from "./recipes.js";

/** Рецепты «на каждый день» — всегда показываются в начальном списке идей. */
const NUTRITION_EVERYDAY_RECIPE_IDS = new Set([
  "rice-chicken-bowl",
  "quinoa-bowl",
  "egg-fried-rice",
]);

export function isNutritionEverydayRecipe(recipe: NutritionRecipe): boolean {
  return NUTRITION_EVERYDAY_RECIPE_IDS.has(recipe.id);
}

export function getNutritionRecipesForMeal(meal: NutritionMeal): NutritionRecipe[] {
  return NUTRITION_RECIPES.filter((recipe) => recipe.meal === meal);
}

export function pickNutritionMealIdeas(
  meal: NutritionMeal,
  limit = 6,
): NutritionRecipe[] {
  const forMeal = getNutritionRecipesForMeal(meal);
  const everyday = forMeal.filter(isNutritionEverydayRecipe);
  const others = forMeal
    .filter((recipe) => !isNutritionEverydayRecipe(recipe))
    .sort(
      (left, right) =>
        left.prepMinutes + left.cookMinutes - (right.prepMinutes + right.cookMinutes),
    );

  return [...everyday, ...others].slice(0, Math.max(limit, everyday.length));
}
