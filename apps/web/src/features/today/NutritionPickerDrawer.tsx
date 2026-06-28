import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  getNutritionIngredient,
  getNutritionRecipe,
  getNutritionRecipesForMeal,
  parseNutritionProductsText,
  pickNutritionMealIdeas,
} from "@mytodo/shared";
import {
  afterKeyboardDismiss,
  clearKeyboardScrollPadding,
  getScrollParent,
  scrollElementStartIntoView,
} from "../../utils/scrollPanelIntoView";

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
  if (hour < 12) {
    return "breakfast";
  }
  if (hour < 18) {
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

function mealIdeas(meal: PickableMeal): NutritionRecipe[] {
  return pickNutritionMealIdeas(meal, MEAL_SUGGESTION_LIMIT);
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
  initialLog?: HabitNutritionLog | null;
  openToSavedRecipe?: boolean;
};

export function NutritionPickerDrawer({
  initialLog = null,
  openToSavedRecipe = false,
}: NutritionPickerDrawerProps) {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const keyboardDismissCleanupRef = useRef<(() => void) | null>(null);
  const initialPanelRecipe = openToSavedRecipe ? resolveInitialPanelRecipe(initialLog) : null;
  const [selectedMeal, setSelectedMeal] = useState<PickableMeal>(() =>
    openToSavedRecipe ? resolveInitialMeal(initialLog) : defaultMealByTime(),
  );
  const [productsDraft, setProductsDraft] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<string[]>([]);
  const [unrecognizedProducts, setUnrecognizedProducts] = useState<string[]>([]);
  const [isProductsFocused, setIsProductsFocused] = useState(false);
  const [panelRecipe, setPanelRecipe] = useState<NutritionRecipe | null>(initialPanelRecipe);
  const [detailOpen, setDetailOpen] = useState(false);
  const openedInitialDetailRef = useRef(false);

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
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      keyboardDismissCleanupRef.current?.();
    };
  }, []);

  const productsDraftRef = useRef(productsDraft);
  productsDraftRef.current = productsDraft;

  const draftAtFocusRef = useRef<string | null>(null);

  const isEditingProducts =
    isProductsFocused &&
    draftAtFocusRef.current != null &&
    productsDraft !== draftAtFocusRef.current;

  const commitProductsDraft = useCallback((text: string) => {
    const parsed = parseNutritionProductsText(text);
    setSelectedIds(parsed.ingredientIds);
    setUnrecognizedProducts(parsed.unrecognized);
    return parsed;
  }, []);

  const closeDetail = () => {
    setDetailOpen(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setPanelRecipe(null);
    }, DETAIL_CLOSE_MS);
  };

  const handleProductsDraftChange = (text: string) => {
    setProductsDraft(text);
  };

  const handleProductsFocus = () => {
    setIsProductsFocused(true);
    draftAtFocusRef.current = productsDraftRef.current;
  };

  const handleProductsBlur = () => {
    const draftAtFocus = draftAtFocusRef.current;
    const text = productsDraftRef.current;
    const edited = draftAtFocus != null && text !== draftAtFocus;

    setIsProductsFocused(false);
    draftAtFocusRef.current = null;
    const parsed = commitProductsDraft(text);

    if (!edited) {
      return;
    }

    const nextAppliedIds =
      parsed.ingredientIds.length >= NUTRITION_MIN_INGREDIENTS ? parsed.ingredientIds : [];
    setAppliedSuggestionIds(nextAppliedIds);

    const card = rootRef.current?.closest<HTMLElement>(".home__plan-item");
    if (!card) {
      return;
    }

    keyboardDismissCleanupRef.current?.();
    keyboardDismissCleanupRef.current = afterKeyboardDismiss(() => {
      keyboardDismissCleanupRef.current = null;
      const scrollParent = getScrollParent(card);
      clearKeyboardScrollPadding(scrollParent);
      scrollElementStartIntoView(card, scrollParent);
    });
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
    const mealRecipes = getNutritionRecipesForMeal(selectedMeal);
    if (appliedSuggestionIds.length >= NUTRITION_MIN_INGREDIENTS) {
      const matches = matchNutritionRecipes(appliedSuggestionIds, mealRecipes, {
        limit: MEAL_SUGGESTION_LIMIT,
      });
      if (matches.length > 0) {
        return { kind: "matches" as const, matches, nearMisses: [] };
      }
      return {
        kind: "nearMisses" as const,
        matches: [],
        nearMisses: findNutritionNearMisses(appliedSuggestionIds, mealRecipes, 3),
      };
    }
    return { kind: "ideas" as const, ideas: mealIdeas(selectedMeal), matches: [], nearMisses: [] };
  }, [selectedMeal, appliedSuggestionIds]);

  const ingredientIdsForRecipe = useMemo(() => {
    if (appliedSuggestionIds.length >= NUTRITION_MIN_INGREDIENTS) {
      return appliedSuggestionIds;
    }
    if (selectedIds.length >= NUTRITION_MIN_INGREDIENTS) {
      return selectedIds;
    }
    return [];
  }, [appliedSuggestionIds, selectedIds]);

  const displayRecipe = useMemo(() => {
    if (!panelRecipe) {
      return null;
    }
    if (ingredientIdsForRecipe.length >= NUTRITION_MIN_INGREDIENTS) {
      return personalizeNutritionRecipe(panelRecipe, ingredientIdsForRecipe);
    }
    return panelRecipe;
  }, [panelRecipe, ingredientIdsForRecipe]);

  const missingIngredients = useMemo(
    () => (panelRecipe ? missingRequiredIngredients(panelRecipe, ingredientIdsForRecipe) : []),
    [panelRecipe, ingredientIdsForRecipe],
  );

  const handleSelectRecipe = (recipe: NutritionRecipe) => {
    openDetail(recipe);
  };

  const handleMealChange = (meal: PickableMeal) => {
    setSelectedMeal(meal);
    if (panelRecipe?.meal !== meal) {
      closeDetail();
    }
  };

  const ingredientCountForRecipe = (recipe: NutritionRecipe) =>
    appliedSuggestionIds.length >= NUTRITION_MIN_INGREDIENTS
      ? personalizeNutritionRecipe(recipe, appliedSuggestionIds).ingredients.length
      : recipe.ingredients.filter((item) => !item.optional).length;

  const suggestionsLabel =
    appliedSuggestionIds.length >= NUTRITION_MIN_INGREDIENTS
      ? suggestions.kind === "nearMisses"
        ? "Почти подходят"
        : "Можно приготовить"
      : "Идеи на сегодня";

  return (
    <div className="home__nutrition-picker" ref={rootRef}>
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
                        onClick={() => handleSelectRecipe(recipe)}
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
                        onClick={() => handleSelectRecipe(match.recipe)}
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
                          onClick={() => handleSelectRecipe(item.recipe)}
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
                      {ingredientIdsForRecipe.length >= NUTRITION_MIN_INGREDIENTS
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
            value={productsDraft}
            enterKeyHint="done"
            onChange={(event) => handleProductsDraftChange(event.target.value)}
            onFocus={handleProductsFocus}
            onBlur={handleProductsBlur}
          />
        </label>
        <p className="home__nutrition-products-hint">
          Через пробел или запятую · от {NUTRITION_MIN_INGREDIENTS} продуктов — подберём из
          холодильника
        </p>

        <NutritionInlineReveal open={!isEditingProducts && selectedIds.length > 0}>
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

        <NutritionInlineReveal open={!isEditingProducts && unrecognizedProducts.length > 0}>
          <p className="home__nutrition-alert home__nutrition-alert--warn">
            Не нашли в каталоге: {unrecognizedProducts.join(", ")}
          </p>
        </NutritionInlineReveal>
      </section>

    </div>
  );
};
