import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  findNutritionNearMisses,
  matchNutritionRecipes,
  personalizeNutritionRecipe,
} from "@mytodo/domain";
import type { HabitNutritionLog, NutritionMeal, NutritionRecipe } from "@mytodo/shared";
import {
  NUTRITION_MEAL_LABELS,
  NUTRITION_METHOD_LABELS,
  NUTRITION_MIN_INGREDIENTS,
  NUTRITION_RECIPES,
  formatNutritionIngredientIds,
  getNutritionIngredient,
  getNutritionRecipe,
  parseNutritionProductsText,
} from "@mytodo/shared";
import { putNutritionTodayLog } from "../../lib/api";

function NutritionInlineReveal({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "home__nutrition-inline-reveal",
        open ? "home__nutrition-inline-reveal--open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!open}
    >
      <div className="home__nutrition-inline-reveal-inner">
        <div
          className={[
            "home__nutrition-inline-reveal-content",
            open ? "home__nutrition-inline-reveal-content--visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const PICKABLE_MEALS = ["breakfast", "lunch", "dinner"] as const;
type PickableMeal = (typeof PICKABLE_MEALS)[number];

const MEAL_SUGGESTION_LIMIT = 6;
const DETAIL_CLOSE_MS = 420;

function defaultMealByTime(): PickableMeal {
  const hour = new Date().getHours();
  if (hour < 11) {
    return "breakfast";
  }
  if (hour < 16) {
    return "lunch";
  }
  return "dinner";
}

function resolveInitialMeal(log: HabitNutritionLog | null): PickableMeal {
  if (log?.recipe_id) {
    const recipe = getNutritionRecipe(log.recipe_id);
    if (recipe && recipe.meal !== "snack" && PICKABLE_MEALS.includes(recipe.meal as PickableMeal)) {
      return recipe.meal as PickableMeal;
    }
  }
  return defaultMealByTime();
}

function resolveInitialPanelRecipe(log: HabitNutritionLog | null): NutritionRecipe | null {
  if (!log?.recipe_id) {
    return null;
  }
  const recipe = getNutritionRecipe(log.recipe_id);
  if (!recipe || recipe.meal === "snack") {
    return null;
  }
  return recipe;
}

function recipesForMeal(meal: PickableMeal): NutritionRecipe[] {
  return NUTRITION_RECIPES.filter((recipe) => recipe.meal === meal);
}

function mealIdeas(meal: PickableMeal): NutritionRecipe[] {
  return [...recipesForMeal(meal)]
    .sort(
      (left, right) =>
        left.prepMinutes + left.cookMinutes - (right.prepMinutes + right.cookMinutes),
    )
    .slice(0, MEAL_SUGGESTION_LIMIT);
}

function missingRequiredIngredients(
  recipe: NutritionRecipe,
  selectedIds: string[],
): NutritionRecipe["ingredients"] {
  if (selectedIds.length === 0) {
    return [];
  }
  const selected = new Set(selectedIds);
  return recipe.ingredients.filter((item) => !item.optional && !selected.has(item.id));
}

type NutritionPickerDrawerProps = {
  habitId: string;
  initialLog?: HabitNutritionLog | null;
  openToSavedRecipe?: boolean;
};

export function NutritionPickerDrawer({
  habitId,
  initialLog = null,
  openToSavedRecipe = false,
}: NutritionPickerDrawerProps) {
  const queryClient = useQueryClient();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialPanelRecipe = openToSavedRecipe ? resolveInitialPanelRecipe(initialLog) : null;
  const [selectedMeal, setSelectedMeal] = useState<PickableMeal>(() => resolveInitialMeal(initialLog));
  const [productsText, setProductsText] = useState(() =>
    initialLog?.ingredient_ids.length
      ? formatNutritionIngredientIds(initialLog.ingredient_ids)
      : "",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialLog?.ingredient_ids ?? []);
  const [unrecognizedProducts, setUnrecognizedProducts] = useState<string[]>([]);
  const [panelRecipe, setPanelRecipe] = useState<NutritionRecipe | null>(initialPanelRecipe);
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const panelRecipeRef = useRef(panelRecipe);
  const openedInitialDetailRef = useRef(false);

  panelRecipeRef.current = panelRecipe;

  useEffect(() => {
    if (!openToSavedRecipe || openedInitialDetailRef.current || !initialPanelRecipe) {
      return;
    }
    openedInitialDetailRef.current = true;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDetailOpen(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [openToSavedRecipe, initialPanelRecipe]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const persistLog = async (ingredientIds: string[], recipeId?: string) => {
    if (ingredientIds.length < NUTRITION_MIN_INGREDIENTS) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await putNutritionTodayLog(habitId, {
        ingredient_ids: ingredientIds,
        ...(recipeId ? { recipe_id: recipeId } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["today", "light"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setIsSaving(false);
    }
  };

  const schedulePersist = (ingredientIds: string[], recipeId?: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void persistLog(ingredientIds, recipeId ?? panelRecipeRef.current?.id);
    }, 500);
  };

  const handleProductsChange = (text: string) => {
    setProductsText(text);
    setError(null);
    const parsed = parseNutritionProductsText(text);
    setSelectedIds(parsed.ingredientIds);
    setUnrecognizedProducts(parsed.unrecognized);
    schedulePersist(parsed.ingredientIds);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setPanelRecipe(null);
    }, DETAIL_CLOSE_MS);
  };

  const openDetail = (recipe: NutritionRecipe) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setPanelRecipe(recipe);
    setDetailOpen(true);
  };

  const suggestions = useMemo(() => {
    const mealRecipes = recipesForMeal(selectedMeal);
    if (selectedIds.length >= NUTRITION_MIN_INGREDIENTS) {
      const matches = matchNutritionRecipes(selectedIds, mealRecipes, {
        limit: MEAL_SUGGESTION_LIMIT,
      });
      if (matches.length > 0) {
        return { kind: "matches" as const, matches, nearMisses: [] };
      }
      return {
        kind: "nearMisses" as const,
        matches: [],
        nearMisses: findNutritionNearMisses(selectedIds, mealRecipes, 3),
      };
    }
    return { kind: "ideas" as const, ideas: mealIdeas(selectedMeal), matches: [], nearMisses: [] };
  }, [selectedMeal, selectedIds]);

  const displayRecipe = useMemo(() => {
    if (!panelRecipe) {
      return null;
    }
    if (selectedIds.length >= NUTRITION_MIN_INGREDIENTS) {
      return personalizeNutritionRecipe(panelRecipe, selectedIds);
    }
    return panelRecipe;
  }, [panelRecipe, selectedIds]);

  const missingIngredients = useMemo(
    () => (panelRecipe ? missingRequiredIngredients(panelRecipe, selectedIds) : []),
    [panelRecipe, selectedIds],
  );

  const handleSelectRecipe = async (recipe: NutritionRecipe) => {
    openDetail(recipe);
    if (selectedIds.length >= NUTRITION_MIN_INGREDIENTS) {
      await persistLog(selectedIds, recipe.id);
    }
  };

  const handleMealChange = (meal: PickableMeal) => {
    setSelectedMeal(meal);
    if (panelRecipe?.meal !== meal) {
      closeDetail();
    }
  };

  const ingredientCountForRecipe = (recipe: NutritionRecipe) =>
    selectedIds.length >= NUTRITION_MIN_INGREDIENTS
      ? personalizeNutritionRecipe(recipe, selectedIds).ingredients.length
      : recipe.ingredients.filter((item) => !item.optional).length;

  const suggestionsLabel =
    selectedIds.length >= NUTRITION_MIN_INGREDIENTS
      ? suggestions.kind === "nearMisses"
        ? "Почти подходят"
        : "Можно приготовить"
      : "Идеи на сегодня";

  return (
    <div className="home__nutrition-picker">
      <div
        className="home__nutrition-meals"
        role="tablist"
        aria-label="Приём пищи"
        onClick={(event) => event.stopPropagation()}
      >
        {PICKABLE_MEALS.map((meal) => (
          <button
            key={meal}
            type="button"
            role="tab"
            aria-selected={selectedMeal === meal}
            className={[
              "home__nutrition-meal",
              selectedMeal === meal ? "home__nutrition-meal--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => handleMealChange(meal)}
          >
            {NUTRITION_MEAL_LABELS[meal as NutritionMeal]}
          </button>
        ))}
      </div>

      <NutritionInlineReveal open={Boolean(error)}>
        {error ? <p className="home__nutrition-alert home__nutrition-alert--error">{error}</p> : null}
      </NutritionInlineReveal>

      <div className="home__nutrition-stage">
        <div
          className={[
            "home__nutrition-view-shell",
            !detailOpen ? "home__nutrition-view-shell--open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden={detailOpen}
        >
          <div className="home__nutrition-view-shell-inner">
            <section
              key={selectedMeal}
              className="home__nutrition-suggestions home__nutrition-fade-in"
            >
              <p className="home__nutrition-suggestions-label">{suggestionsLabel}</p>

              {suggestions.kind === "ideas" ? (
                <ul className="home__nutrition-recipes">
                  {suggestions.ideas.map((recipe, index) => (
                    <li
                      key={recipe.id}
                      className="home__nutrition-recipe-item home__nutrition-fade-in"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <button
                        type="button"
                        className="home__nutrition-recipe"
                        onClick={() => void handleSelectRecipe(recipe)}
                      >
                        <span className="home__nutrition-recipe-name">{recipe.title}</span>
                        <span className="home__nutrition-recipe-meta">
                          {recipe.prepMinutes + recipe.cookMinutes} мин · ~
                          {recipe.caloriesPerServing} ккал
                        </span>
                        <span className="home__nutrition-recipe-summary">{recipe.summary}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {suggestions.kind === "matches" ? (
                <ul className="home__nutrition-recipes">
                  {suggestions.matches.map((match, index) => (
                    <li
                      key={match.recipe.id}
                      className="home__nutrition-recipe-item home__nutrition-fade-in"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <button
                        type="button"
                        className="home__nutrition-recipe home__nutrition-recipe--match"
                        onClick={() => void handleSelectRecipe(match.recipe)}
                      >
                        <span className="home__nutrition-recipe-name">{match.recipe.title}</span>
                        <span className="home__nutrition-recipe-meta">
                          {ingredientCountForRecipe(match.recipe)} из ваших ·{" "}
                          {match.recipe.prepMinutes + match.recipe.cookMinutes} мин
                        </span>
                        <span className="home__nutrition-recipe-summary">{match.recipe.summary}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {suggestions.kind === "nearMisses" ? (
                suggestions.nearMisses.length > 0 ? (
                  <ul className="home__nutrition-recipes">
                    {suggestions.nearMisses.map((item, index) => (
                      <li
                        key={item.recipe.id}
                        className="home__nutrition-recipe-item home__nutrition-fade-in"
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <button
                          type="button"
                          className="home__nutrition-recipe home__nutrition-recipe--near-miss"
                          onClick={() => void handleSelectRecipe(item.recipe)}
                        >
                          <span className="home__nutrition-recipe-name">{item.recipe.title}</span>
                          <span className="home__nutrition-recipe-meta">
                            Не хватает: {item.missingLabels.join(", ")}
                          </span>
                          <span className="home__nutrition-recipe-summary">{item.recipe.summary}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="home__nutrition-empty home__nutrition-fade-in">
                    <p className="home__nutrition-empty-title">Пока нет готового рецепта</p>
                    <p className="home__nutrition-empty-text">
                      Добавьте ещё продукты — подберём из вашего холодильника.
                    </p>
                  </div>
                )
              ) : null}
            </section>
          </div>
        </div>

        <div
          className={[
            "home__nutrition-view-shell",
            detailOpen ? "home__nutrition-view-shell--open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden={!detailOpen}
        >
          <div className="home__nutrition-view-shell-inner">
            {displayRecipe ? (
              <section className="home__nutrition-recipe-detail home__nutrition-fade-in">
                <button type="button" className="home__nutrition-back" onClick={closeDetail}>
                  ← К списку
                </button>
                <h4 className="home__nutrition-recipe-title">{displayRecipe.title}</h4>
                <div className="home__nutrition-recipe-tags">
                  <span>{NUTRITION_MEAL_LABELS[displayRecipe.meal]}</span>
                  <span>{NUTRITION_METHOD_LABELS[displayRecipe.method]}</span>
                  <span>{displayRecipe.prepMinutes + displayRecipe.cookMinutes} мин</span>
                  <span>~{displayRecipe.caloriesPerServing} ккал</span>
                </div>
                <p className="home__nutrition-recipe-summary">{displayRecipe.summary}</p>

                {displayRecipe.ingredients.length > 0 ? (
                  <div className="home__nutrition-recipe-section">
                    <p className="home__nutrition-recipe-section-title">
                      {selectedIds.length >= NUTRITION_MIN_INGREDIENTS
                        ? "Из ваших продуктов"
                        : "Ингредиенты"}
                    </p>
                    <ul className="home__nutrition-ingredients">
                      {displayRecipe.ingredients.map((item) => (
                        <li key={`${item.id}-${item.amount}`}>
                          <span>{getNutritionIngredient(item.id)?.label ?? item.id}</span>
                          <span>{item.amount}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {missingIngredients.length > 0 ? (
                  <div className="home__nutrition-recipe-section">
                    <p className="home__nutrition-recipe-section-title">Не хватает</p>
                    <ul className="home__nutrition-ingredients home__nutrition-ingredients--missing">
                      {missingIngredients.map((item) => (
                        <li key={`missing-${item.id}-${item.amount}`}>
                          <span>{getNutritionIngredient(item.id)?.label ?? item.id}</span>
                          <span>{item.amount}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="home__nutrition-recipe-section">
                  <p className="home__nutrition-recipe-section-title">Приготовление</p>
                  <ol className="home__nutrition-steps">
                    {displayRecipe.steps.map((text, index) => (
                      <li
                        key={`${index}-${text}`}
                        className="home__nutrition-fade-in"
                        style={{ animationDelay: `${index * 35}ms` }}
                      >
                        <span className="home__nutrition-step-num">{index + 1}</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <section
        className="home__nutrition-products"
        onClick={(event) => event.stopPropagation()}
      >
        <label className="home__nutrition-products-field">
          <span className="home__nutrition-products-label">Ваши продукты</span>
          <textarea
            className="home__nutrition-products-input"
            rows={3}
            placeholder="яйца, творог, огурец…"
            value={productsText}
            onChange={(event) => handleProductsChange(event.target.value)}
          />
        </label>
        <p className="home__nutrition-products-hint">
          Через пробел или запятую · от {NUTRITION_MIN_INGREDIENTS} продуктов — подберём из
          холодильника
          {isSaving ? " · сохраняем…" : ""}
        </p>

        <NutritionInlineReveal open={selectedIds.length > 0}>
          <div className="home__nutrition-chips-block">
            <p className="home__nutrition-chips-label">Распознали</p>
            <div className="home__nutrition-chips">
              {selectedIds.map((id) => (
                <span key={id} className="home__nutrition-chip home__nutrition-chip--ok">
                  {getNutritionIngredient(id)?.label ?? id}
                </span>
              ))}
            </div>
          </div>
        </NutritionInlineReveal>

        <NutritionInlineReveal open={unrecognizedProducts.length > 0}>
          <p className="home__nutrition-alert home__nutrition-alert--warn">
            Не нашли в каталоге: {unrecognizedProducts.join(", ")}
          </p>
        </NutritionInlineReveal>
      </section>
    </div>
  );
};
