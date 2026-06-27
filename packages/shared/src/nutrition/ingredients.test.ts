import { describe, expect, it } from "vitest";
import {
  formatNutritionIngredientIds,
  parseNutritionProductsText,
} from "./ingredients.js";

describe("parseNutritionProductsText", () => {
  it("parses comma-separated products", () => {
    const result = parseNutritionProductsText("яйца, помидоры, творог");

    expect(result.ingredientIds).toEqual(["egg", "tomato", "cottage_cheese"]);
    expect(result.unrecognized).toEqual([]);
  });

  it("parses space-separated products", () => {
    const result = parseNutritionProductsText("яйца помидоры творог");

    expect(result.ingredientIds).toEqual(["egg", "tomato", "cottage_cheese"]);
    expect(result.unrecognized).toEqual([]);
  });

  it("parses multi-word product names", () => {
    const result = parseNutritionProductsText("куриная грудка рис огурец");

    expect(result.ingredientIds).toEqual(["chicken_breast", "rice", "cucumber"]);
    expect(result.unrecognized).toEqual([]);
  });

  it("recognizes common typo for chicken breast", () => {
    const result = parseNutritionProductsText("куринная грудка рис");

    expect(result.ingredientIds).toEqual(["chicken_breast", "rice"]);
    expect(result.unrecognized).toEqual([]);
  });

  it("parses newline-separated products", () => {
    const result = parseNutritionProductsText("овсянка\nяблоко\nмёд");

    expect(result.ingredientIds).toEqual(["oatmeal", "apple", "honey"]);
    expect(result.unrecognized).toEqual([]);
  });

  it("deduplicates repeated products", () => {
    const result = parseNutritionProductsText("яйцо яйца");

    expect(result.ingredientIds).toEqual(["egg"]);
  });

  it("returns unrecognized tokens", () => {
    const result = parseNutritionProductsText("яйца авокадо помидор");

    expect(result.ingredientIds).toEqual(["egg", "avocado", "tomato"]);
    expect(result.unrecognized).toEqual([]);
  });
});

describe("formatNutritionIngredientIds", () => {
  it("joins ingredient labels", () => {
    expect(formatNutritionIngredientIds(["egg", "tomato"])).toBe("Яйцо Помидор");
  });
});
