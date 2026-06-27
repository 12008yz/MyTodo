import {
  NUTRITION_MATCH_LIMIT,
  NUTRITION_MIN_INGREDIENTS,
  getNutritionIngredient,
  type NutritionRecipe,
} from "@mytodo/shared";

export type MatchedNutritionRecipe = {
  recipe: NutritionRecipe;
  score: number;
  matchedRequired: number;
  totalRequired: number;
  missingRequiredIds: string[];
};

export type MatchNutritionRecipesOptions = {
  limit?: number;
};

export type NutritionNearMiss = {
  recipe: NutritionRecipe;
  missingRequiredIds: string[];
  missingLabels: string[];
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
  const missingRequiredIds = requiredIds.filter((id) => !selectedSet.has(id));

  const optionalMatched = recipe.ingredients.filter(
    (item) => item.optional && selectedSet.has(item.id),
  ).length;

  const coverage = totalRequired > 0 ? matchedRequired / totalRequired : 1;
  const score = coverage + optionalMatched * 0.05;

  return {
    score,
    matchedRequired,
    totalRequired,
    missingRequiredIds,
  };
}

/** Only ingredients the user listed appear in the personalized recipe. */
export function personalizeNutritionRecipe(
  recipe: NutritionRecipe,
  selectedIds: string[],
): NutritionRecipe {
  const selected = new Set(selectedIds);
  return {
    ...recipe,
    ingredients: recipe.ingredients.filter((item) => selected.has(item.id)),
  };
}

/** Recipes the user can cook with exactly the products they named (all required items present). */
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
  const selectedSet = new Set(uniqueIds);

  return recipes
    .map((recipe) => {
      const scored = scoreRecipe(selectedSet, recipe);
      return { recipe, ...scored };
    })
    .filter((item) => item.missingRequiredIds.length === 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const leftTime = left.recipe.prepMinutes + left.recipe.cookMinutes;
      const rightTime = right.recipe.prepMinutes + right.recipe.cookMinutes;
      return leftTime - rightTime;
    })
    .slice(0, limit);
}

/** Hint when nothing matches — what to add for almost-ready recipes. */
export function findNutritionNearMisses(
  selectedIds: string[],
  recipes: NutritionRecipe[],
  limit = 3,
): NutritionNearMiss[] {
  const uniqueIds = [...new Set(selectedIds)];
  if (uniqueIds.length < NUTRITION_MIN_INGREDIENTS) {
    return [];
  }

  const selectedSet = new Set(uniqueIds);

  return recipes
    .map((recipe) => {
      const scored = scoreRecipe(selectedSet, recipe);
      return { recipe, ...scored };
    })
    .filter((item) => item.missingRequiredIds.length > 0 && item.matchedRequired > 0)
    .sort((left, right) => {
      if (right.matchedRequired !== left.matchedRequired) {
        return right.matchedRequired - left.matchedRequired;
      }
      return left.missingRequiredIds.length - right.missingRequiredIds.length;
    })
    .slice(0, limit)
    .map((item) => ({
      recipe: item.recipe,
      missingRequiredIds: item.missingRequiredIds,
      missingLabels: item.missingRequiredIds.map(
        (id) => getNutritionIngredient(id)?.label ?? id,
      ),
    }));
}
