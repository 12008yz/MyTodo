import {
  NUTRITION_FALLBACK_RECIPE_IDS,
  NUTRITION_MATCH_LIMIT,
  NUTRITION_MATCH_MIN_SCORE,
  NUTRITION_MIN_INGREDIENTS,
  type NutritionRecipe,
} from "@mytodo/shared";

export type MatchedNutritionRecipe = {
  recipe: NutritionRecipe;
  score: number;
  matchedRequired: number;
  totalRequired: number;
  missingRequiredIds: string[];
  isFallback?: boolean;
};

export type MatchNutritionRecipesOptions = {
  limit?: number;
  minScore?: number;
};

function scoreRecipe(
  selectedSet: Set<string>,
  recipe: NutritionRecipe,
): Omit<MatchedNutritionRecipe, "recipe"> {
  const required = recipe.ingredients.filter((item) => !item.optional);
  const requiredIds = required.map((item) => item.id);
  const matchedRequiredIds = requiredIds.filter((id) => selectedSet.has(id));
  const totalRequired = requiredIds.length;
  const matchedRequired = matchedRequiredIds.length;
  const baseScore = totalRequired > 0 ? matchedRequired / totalRequired : 0;

  const optionalBonus = Math.min(
    0.15,
    recipe.ingredients.filter((item) => item.optional && selectedSet.has(item.id)).length * 0.05,
  );

  const missingRequiredIds = requiredIds.filter((id) => !selectedSet.has(id));
  const missingPenalty = missingRequiredIds.length * 0.1;

  const score = Math.max(0, Math.min(1, baseScore + optionalBonus - missingPenalty));

  return {
    score,
    matchedRequired,
    totalRequired,
    missingRequiredIds,
  };
}

function buildFallbackMatches(
  recipes: NutritionRecipe[],
  fallbackIds: readonly string[],
): MatchedNutritionRecipe[] {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  return fallbackIds
    .map((id) => byId.get(id))
    .filter((recipe): recipe is NutritionRecipe => recipe != null)
    .map((recipe) => ({
      recipe,
      score: 0,
      matchedRequired: 0,
      totalRequired: recipe.ingredients.filter((item) => !item.optional).length,
      missingRequiredIds: [],
      isFallback: true,
    }));
}

export function matchNutritionRecipes(
  selectedIds: string[],
  recipes: NutritionRecipe[],
  options: MatchNutritionRecipesOptions = {},
): MatchedNutritionRecipe[] {
  const uniqueIds = [...new Set(selectedIds)];
  if (uniqueIds.length < NUTRITION_MIN_INGREDIENTS) {
    return [];
  }

  const limit = options.limit ?? NUTRITION_MATCH_LIMIT;
  const minScore = options.minScore ?? NUTRITION_MATCH_MIN_SCORE;
  const selectedSet = new Set(uniqueIds);

  const ranked = recipes
    .map((recipe) => {
      const scored = scoreRecipe(selectedSet, recipe);
      return { recipe, ...scored };
    })
    .filter((item) => item.score >= minScore)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const leftTime = left.recipe.prepMinutes + left.recipe.cookMinutes;
      const rightTime = right.recipe.prepMinutes + right.recipe.cookMinutes;
      return leftTime - rightTime;
    })
    .slice(0, limit);

  if (ranked.length > 0) {
    return ranked;
  }

  return buildFallbackMatches(recipes, NUTRITION_FALLBACK_RECIPE_IDS).slice(0, limit);
}
