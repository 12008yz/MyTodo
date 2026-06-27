export const NUTRITION_INGREDIENT_CATEGORIES = [
  "vegetables",
  "protein",
  "dairy",
  "grains",
  "pantry",
] as const;

export type NutritionIngredientCategory = (typeof NUTRITION_INGREDIENT_CATEGORIES)[number];

export type NutritionIngredient = {
  id: string;
  label: string;
  category: NutritionIngredientCategory;
  aliases?: string[];
};

export const NUTRITION_MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type NutritionMeal = (typeof NUTRITION_MEALS)[number];

export const NUTRITION_METHODS = ["bake", "boil", "steam", "stew", "mix"] as const;
export type NutritionMethod = (typeof NUTRITION_METHODS)[number];

export const NUTRITION_RECIPE_TAGS = ["pp", "high_protein", "quick"] as const;
export type NutritionRecipeTag = (typeof NUTRITION_RECIPE_TAGS)[number];

export type NutritionRecipeIngredient = {
  id: string;
  amount: string;
  optional?: boolean;
};

export type NutritionRecipe = {
  id: string;
  title: string;
  summary: string;
  meal: NutritionMeal;
  method: NutritionMethod;
  prepMinutes: number;
  cookMinutes: number;
  caloriesPerServing: number;
  servings: number;
  ingredients: NutritionRecipeIngredient[];
  steps: string[];
  tags: NutritionRecipeTag[];
};

export const NUTRITION_METHOD_LABELS: Record<NutritionMethod, string> = {
  bake: "Запекание",
  boil: "Варка",
  steam: "На пару",
  stew: "Тушение",
  mix: "Без термообработки",
};

export const NUTRITION_MEAL_LABELS: Record<NutritionMeal, string> = {
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
};

export const NUTRITION_CATEGORY_LABELS: Record<NutritionIngredientCategory, string> = {
  vegetables: "Овощи",
  protein: "Белок",
  dairy: "Молочное",
  grains: "Крупы",
  pantry: "Кладовая",
};
