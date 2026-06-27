import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  findNutritionNearMisses,
  matchNutritionRecipes,
  personalizeNutritionRecipe,
} from "@mytodo/domain";
import {
  NUTRITION_MEAL_LABELS,
  NUTRITION_METHOD_LABELS,
  NUTRITION_MIN_INGREDIENTS,
  NUTRITION_RECIPES,
  formatNutritionIngredientIds,
  getNutritionIngredient,
  isCompanionLightHabit,
  parseNutritionProductsText,
  type NutritionRecipe,
} from "@mytodo/shared";
import { getNutritionTodayLog, putNutritionTodayLog } from "../../lib/api";
import { useTodayDashboard } from "../../features/today/useTodayData";
import "./NutritionPage.css";

type Step = "ingredients" | "suggestions" | "recipe";

const STEPS: { id: Step; label: string }[] = [
  { id: "ingredients", label: "Продукты" },
  { id: "suggestions", label: "Рецепты" },
  { id: "recipe", label: "Готовим" },
];

function stepIndex(step: Step): number {
  return STEPS.findIndex((item) => item.id === step);
}

export function NutritionPage() {
  const { habitId } = useParams<{ habitId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dashboard, isLoading } = useTodayDashboard("light");

  const habit = useMemo(
    () => dashboard?.habits.find((row) => row.id === habitId) ?? null,
    [dashboard?.habits, habitId],
  );

  const [step, setStep] = useState<Step>("ingredients");
  const [productsText, setProductsText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [unrecognizedProducts, setUnrecognizedProducts] = useState<string[]>([]);
  const [matches, setMatches] = useState<ReturnType<typeof matchNutritionRecipes>>([]);
  const [activeRecipe, setActiveRecipe] = useState<NutritionRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!habitId || hydrated) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const log = await getNutritionTodayLog(habitId);
        if (cancelled) {
          return;
        }
        if (log) {
          setSelectedIds(log.ingredient_ids);
          setProductsText(formatNutritionIngredientIds(log.ingredient_ids));
          if (log.ingredient_ids.length >= NUTRITION_MIN_INGREDIENTS) {
            setMatches(matchNutritionRecipes(log.ingredient_ids, NUTRITION_RECIPES));
          }
          if (log.recipe_id) {
            const recipe = NUTRITION_RECIPES.find((row) => row.id === log.recipe_id) ?? null;
            setActiveRecipe(recipe);
          }
        }
        setStep("ingredients");
      } catch {
        setStep("ingredients");
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [habitId, hydrated]);

  const recognizedPreview = parseNutritionProductsText(productsText);
  const activeStepIndex = stepIndex(step);
  const nearMisses = useMemo(
    () =>
      selectedIds.length >= NUTRITION_MIN_INGREDIENTS
        ? findNutritionNearMisses(selectedIds, NUTRITION_RECIPES)
        : [],
    [selectedIds],
  );
  const displayRecipe = useMemo(
    () => (activeRecipe ? personalizeNutritionRecipe(activeRecipe, selectedIds) : null),
    [activeRecipe, selectedIds],
  );

  const goToStep = (next: Step) => {
    if (next === "suggestions" && selectedIds.length < NUTRITION_MIN_INGREDIENTS) {
      return;
    }
    if (next === "recipe" && !activeRecipe) {
      return;
    }
    setStep(next);
  };

  if (!habitId) {
    return (
      <div className="nutrition-page">
        <p className="nutrition-page__status">Привычка не найдена</p>
      </div>
    );
  }

  if (isLoading && !habit) {
    return (
      <div className="nutrition-page">
        <p className="nutrition-page__status">Загрузка…</p>
      </div>
    );
  }

  if (!habit || !isCompanionLightHabit(habit)) {
    return (
      <div className="nutrition-page">
        <div className="nutrition-page__shell">
          <p className="nutrition-page__status">Это не привычка «Правильное питание»</p>
          <button
            type="button"
            className="nutrition-page__btn nutrition-page__btn--ghost"
            onClick={() => navigate("/")}
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="nutrition-page">
        <p className="nutrition-page__status">Загрузка…</p>
      </div>
    );
  }

  const persistLog = async (ingredientIds: string[], recipeId?: string) => {
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

  const handleFindRecipes = async () => {
    const parsed = parseNutritionProductsText(productsText);
    setUnrecognizedProducts(parsed.unrecognized);

    if (parsed.ingredientIds.length < NUTRITION_MIN_INGREDIENTS) {
      setError(
        `Укажите хотя бы ${NUTRITION_MIN_INGREDIENTS} продукта — через пробел, запятую или с новой строки`,
      );
      return;
    }

    setError(null);
    setSelectedIds(parsed.ingredientIds);
    const result = matchNutritionRecipes(parsed.ingredientIds, NUTRITION_RECIPES);
    setMatches(result);
    setStep("suggestions");
    await persistLog(parsed.ingredientIds);
  };

  const handleSelectRecipe = async (recipe: NutritionRecipe) => {
    setActiveRecipe(recipe);
    setStep("recipe");
    await persistLog(selectedIds, recipe.id);
  };

  const ingredientCountForRecipe = (recipe: NutritionRecipe) =>
    personalizeNutritionRecipe(recipe, selectedIds).ingredients.length;

  return (
    <div className="nutrition-page">
      <div className="nutrition-page__glow nutrition-page__glow--green" aria-hidden="true" />
      <div className="nutrition-page__glow nutrition-page__glow--purple" aria-hidden="true" />

      <div className="nutrition-page__shell">
        <header className="nutrition-page__header">
          <button type="button" className="nutrition-page__back" onClick={() => navigate("/")}>
            ← На главную
          </button>
          <div className="nutrition-page__headline">
            <h1 className="nutrition-page__title">Правильное питание</h1>
            <p className="nutrition-page__subtitle">
              {step === "ingredients" && "Напишите, что есть дома — подберём рецепты"}
              {step === "suggestions" && "Выберите, что приготовить"}
              {step === "recipe" && (activeRecipe?.title ?? "Готовим")}
            </p>
          </div>
          <ol className="nutrition-page__steps" aria-label="Шаги">
            {STEPS.map((item, index) => {
              const isActive = item.id === step;
              const isDone = index < activeStepIndex;
              const isDisabled =
                (item.id === "suggestions" && selectedIds.length < NUTRITION_MIN_INGREDIENTS) ||
                (item.id === "recipe" && !activeRecipe);

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={[
                      "nutrition-page__step",
                      isActive ? "nutrition-page__step--active" : "",
                      isDone ? "nutrition-page__step--done" : "",
                      isDisabled ? "nutrition-page__step--disabled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isDisabled}
                    onClick={() => goToStep(item.id)}
                  >
                    <span className="nutrition-page__step-dot" aria-hidden="true" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </header>

        <main className="nutrition-page__main">
          {error ? <p className="nutrition-page__alert nutrition-page__alert--error">{error}</p> : null}

          {step === "ingredients" ? (
            <section className="nutrition-page__panel">
              <label className="nutrition-page__field">
                <span className="nutrition-page__field-label">Ваши продукты</span>
                <textarea
                  className="nutrition-page__textarea"
                  rows={6}
                  placeholder={"Например:\nогурец творог рис куриная грудка\nяйца помидоры"}
                  value={productsText}
                  onChange={(event) => {
                    setProductsText(event.target.value);
                    setError(null);
                  }}
                />
              </label>
              <p className="nutrition-page__field-hint">
                Пишите через пробел, запятую или с новой строки · минимум {NUTRITION_MIN_INGREDIENTS}{" "}
                продукта
              </p>

              {recognizedPreview.ingredientIds.length > 0 ? (
                <div className="nutrition-page__chips-block">
                  <p className="nutrition-page__chips-label">Распознали</p>
                  <div className="nutrition-page__chips">
                    {recognizedPreview.ingredientIds.map((id) => (
                      <span key={id} className="nutrition-page__chip nutrition-page__chip--ok">
                        {getNutritionIngredient(id)?.label ?? id}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {unrecognizedProducts.length > 0 ? (
                <p className="nutrition-page__alert nutrition-page__alert--warn">
                  Не нашли в каталоге: {unrecognizedProducts.join(", ")}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "suggestions" ? (
            <section className="nutrition-page__suggestions">
              <div className="nutrition-page__products-bar">
                <p className="nutrition-page__chips-label">Из ваших продуктов</p>
                <div className="nutrition-page__chips">
                  {selectedIds.map((id) => (
                    <span key={id} className="nutrition-page__chip nutrition-page__chip--ok">
                      {getNutritionIngredient(id)?.label ?? id}
                    </span>
                  ))}
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="nutrition-page__empty">
                  <div className="nutrition-page__empty-icon" aria-hidden="true">
                    🥗
                  </div>
                  <p className="nutrition-page__empty-title">Пока нет готового рецепта</p>
                  <p className="nutrition-page__empty-text">
                    Добавьте ещё продукты или измените список — подскажем, чего не хватает.
                  </p>
                  {nearMisses.length > 0 ? (
                    <div className="nutrition-page__near-misses">
                      {nearMisses.map((item) => (
                        <article key={item.recipe.id} className="nutrition-page__near-miss-card">
                          <h3 className="nutrition-page__near-miss-title">{item.recipe.title}</h3>
                          <p className="nutrition-page__near-miss-label">Не хватает</p>
                          <div className="nutrition-page__chips">
                            {item.missingLabels.map((label) => (
                              <span key={label} className="nutrition-page__chip nutrition-page__chip--missing">
                                {label}
                              </span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="nutrition-page__cards">
                  {matches.map((match) => (
                    <button
                      key={match.recipe.id}
                      type="button"
                      className="nutrition-page__card"
                      onClick={() => void handleSelectRecipe(match.recipe)}
                    >
                      <div className="nutrition-page__card-top">
                        <h2 className="nutrition-page__card-title">{match.recipe.title}</h2>
                        <span className="nutrition-page__card-match">
                          {ingredientCountForRecipe(match.recipe)} из ваших
                        </span>
                      </div>
                      <p className="nutrition-page__card-summary">{match.recipe.summary}</p>
                      <div className="nutrition-page__card-tags">
                        <span>{NUTRITION_MEAL_LABELS[match.recipe.meal]}</span>
                        <span>{match.recipe.prepMinutes + match.recipe.cookMinutes} мин</span>
                        <span>~{match.recipe.caloriesPerServing} ккал</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {step === "recipe" && !displayRecipe ? (
            <section className="nutrition-page__panel">
              <p className="nutrition-page__alert nutrition-page__alert--info">
                Рецепт не найден. Выберите другой из списка.
              </p>
            </section>
          ) : null}

          {step === "recipe" && displayRecipe ? (
            <section className="nutrition-page__recipe">
              <div className="nutrition-page__recipe-hero">
                <div className="nutrition-page__recipe-tags">
                  <span>{NUTRITION_MEAL_LABELS[displayRecipe.meal]}</span>
                  <span>{NUTRITION_METHOD_LABELS[displayRecipe.method]}</span>
                  <span>{displayRecipe.prepMinutes + displayRecipe.cookMinutes} мин</span>
                  <span>~{displayRecipe.caloriesPerServing} ккал</span>
                </div>
                <p className="nutrition-page__recipe-summary">{displayRecipe.summary}</p>
              </div>

              <div className="nutrition-page__section">
                <h2 className="nutrition-page__section-title">Из ваших продуктов</h2>
                <ul className="nutrition-page__ingredients">
                  {displayRecipe.ingredients.map((item) => {
                    const label = getNutritionIngredient(item.id)?.label ?? item.id;
                    return (
                      <li key={`${item.id}-${item.amount}`}>
                        <span className="nutrition-page__ingredient-name">{label}</span>
                        <span className="nutrition-page__ingredient-amount">{item.amount}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="nutrition-page__section">
                <h2 className="nutrition-page__section-title">Приготовление</h2>
                <ol className="nutrition-page__steps-list">
                  {displayRecipe.steps.map((text, index) => (
                    <li key={text}>
                      <span className="nutrition-page__step-num">{index + 1}</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : null}
        </main>

        <footer className="nutrition-page__footer">
          {step === "ingredients" ? (
            <button
              type="button"
              className="nutrition-page__btn nutrition-page__btn--primary"
              disabled={!productsText.trim() || isSaving}
              onClick={() => void handleFindRecipes()}
            >
              {isSaving ? "Подбираем…" : "Подобрать рецепт"}
            </button>
          ) : null}

          {step === "suggestions" ? (
            <button
              type="button"
              className="nutrition-page__btn nutrition-page__btn--ghost"
              onClick={() => setStep("ingredients")}
            >
              Изменить продукты
            </button>
          ) : null}

          {step === "recipe" ? (
            <>
              <button
                type="button"
                className="nutrition-page__btn nutrition-page__btn--ghost"
                onClick={() => {
                  setMatches(matchNutritionRecipes(selectedIds, NUTRITION_RECIPES));
                  setStep("suggestions");
                }}
              >
                Другой рецепт
              </button>
              <button
                type="button"
                className="nutrition-page__btn nutrition-page__btn--primary"
                onClick={() => navigate("/")}
              >
                На главную
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
