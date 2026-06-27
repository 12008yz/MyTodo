import { describe, expect, it } from "vitest";
import { NUTRITION_RECIPES } from "@mytodo/shared";
import {
  findNutritionNearMisses,
  matchNutritionRecipes,
  personalizeNutritionRecipe,
} from "./match.js";

describe("matchNutritionRecipes", () => {
  it("returns empty when fewer than 2 ingredients", () => {
    expect(matchNutritionRecipes(["egg"], NUTRITION_RECIPES)).toEqual([]);
  });

  it("returns only recipes where all required ingredients are available", () => {
    const matches = matchNutritionRecipes(
      ["egg", "tomato", "bell_pepper", "spinach"],
      NUTRITION_RECIPES,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((item) => item.missingRequiredIds.length === 0)).toBe(true);
    expect(matches.some((item) => item.recipe.id === "veg-omelet")).toBe(true);
  });

  it("excludes recipes with missing required ingredients", () => {
    const matches = matchNutritionRecipes(["egg", "tomato"], NUTRITION_RECIPES);

    expect(matches.every((item) => item.missingRequiredIds.length === 0)).toBe(true);
    expect(matches.some((item) => item.recipe.id === "veg-omelet")).toBe(false);
  });

  it("returns empty when nothing fully matches", () => {
    expect(matchNutritionRecipes(["ginger", "soy_sauce"], NUTRITION_RECIPES)).toEqual([]);
  });

  it("deduplicates selected ingredient ids", () => {
    const matches = matchNutritionRecipes(
      ["egg", "egg", "oatmeal", "apple"],
      NUTRITION_RECIPES,
    );

    expect(matches.some((item) => item.recipe.id === "oat-apple")).toBe(true);
  });
});

describe("findNutritionNearMisses", () => {
  it("suggests missing products for almost-matching recipes", () => {
    const nearMisses = findNutritionNearMisses(["egg", "tomato"], NUTRITION_RECIPES);

    expect(nearMisses.length).toBeGreaterThan(0);
    expect(nearMisses[0]?.missingLabels.length).toBeGreaterThan(0);
  });
});

describe("personalizeNutritionRecipe", () => {
  it("keeps only ingredients the user listed", () => {
    const recipe = NUTRITION_RECIPES.find((item) => item.id === "veg-omelet");
    expect(recipe).toBeDefined();

    const personalized = personalizeNutritionRecipe(recipe!, ["egg", "tomato", "spinach"]);

    expect(personalized.ingredients.every((item) =>
      ["egg", "tomato", "spinach"].includes(item.id),
    )).toBe(true);
    expect(personalized.ingredients.some((item) => item.id === "bell_pepper")).toBe(false);
  });
});
