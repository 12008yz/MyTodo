import { describe, expect, it } from "vitest";
import { NUTRITION_RECIPES } from "@mytodo/shared";
import { matchNutritionRecipes } from "./match.js";

describe("matchNutritionRecipes", () => {
  it("returns empty when fewer than 2 ingredients", () => {
    expect(matchNutritionRecipes(["egg"], NUTRITION_RECIPES)).toEqual([]);
  });

  it("ranks recipes with more required matches higher", () => {
    const matches = matchNutritionRecipes(
      ["egg", "tomato", "bell_pepper", "spinach", "olive_oil"],
      NUTRITION_RECIPES,
    );

    expect(matches[0]?.recipe.id).toBe("veg-omelet");
    expect(matches[0]?.matchedRequired).toBeGreaterThanOrEqual(3);
  });

  it("returns fallback recipes when nothing matches threshold", () => {
    const matches = matchNutritionRecipes(["ginger", "soy_sauce"], NUTRITION_RECIPES);

    expect(matches).toHaveLength(3);
    expect(matches.every((item) => item.isFallback)).toBe(true);
  });

  it("deduplicates selected ingredient ids", () => {
    const matches = matchNutritionRecipes(
      ["egg", "egg", "oatmeal", "apple"],
      NUTRITION_RECIPES,
    );

    expect(matches.some((item) => item.recipe.id === "oat-apple")).toBe(true);
  });
});
