import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { matchNutritionRecipes } from "@mytodo/domain";
import {
  NUTRITION_MEAL_LABELS,
  NUTRITION_METHOD_LABELS,
  NUTRITION_MIN_INGREDIENTS,
  NUTRITION_RECIPES,
  formatNutritionIngredientIds,
  getNutritionIngredient,
  isCompanionLightHabit,
  parseNutritionProductsText,
  type HabitNutritionLog,
  type NutritionRecipe,
} from "@mytodo/shared";
import { getNutritionTodayLog, putNutritionTodayLog } from "../../lib/api";
import { useTodayDashboard } from "../../features/today/useTodayData";
import "./NutritionPage.css";

type Step = "ingredients" | "suggestions" | "recipe";

function logStep(log: HabitNutritionLog | null): Step {
  if (log?.recipe_id) {
    return "recipe";
  }
  return "ingredients";
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
          const nextStep = logStep(log);
          setStep(nextStep);
          if (log.recipe_id) {
            const recipe = NUTRITION_RECIPES.find((row) => row.id === log.recipe_id) ?? null;
            setActiveRecipe(recipe);
            if (nextStep === "suggestions") {
              setMatches(matchNutritionRecipes(log.ingredient_ids, NUTRITION_RECIPES));
            }
          }
        }
      } catch {
        // demo/offline — остаёмся на шаге продуктов
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
        <p className="nutrition-page__status">Это не привычка «Правильное питание»</p>
        <button type="button" className="nutrition-page__btn nutrition-page__btn--secondary" onClick={() => navigate("/")}>
          На главную
        </button>
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
      setError(`Укажите хотя бы ${NUTRITION_MIN_INGREDIENTS} продукта через запятую или с новой строки`);
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

  const selectedSet = new Set(selectedIds);
  const recognizedPreview = parseNutritionProductsText(productsText);

  return (
    <div className="nutrition-page">
      <header className="nutrition-page__header">
        <button type="button" className="nutrition-page__back" onClick={() => navigate("/")}>
          ← На главную
        </button>
        <h1 className="nutrition-page__title">Правильное питание</h1>
        <p className="nutrition-page__subtitle">
          {step === "ingredients" && "Перечислите, что есть дома — подберём рецепты"}
          {step === "suggestions" && "Выберите рецепт"}
          {step === "recipe" && activeRecipe?.title}
        </p>
      </header>

      {error ? <p className="nutrition-page__status nutrition-page__status--error">{error}</p> : null}

      {step === "ingredients" ? (
        <>
          <label className="nutrition-page__field">
            <span className="nutrition-page__field-label">Ваши продукты</span>
            <textarea
              className="nutrition-page__textarea"
              rows={6}
              placeholder={"Например:\nяйца, помидоры, творог\nовсянка, яблоко"}
              value={productsText}
              onChange={(event) => {
                setProductsText(event.target.value);
                setError(null);
              }}
            />
          </label>
          {recognizedPreview.ingredientIds.length > 0 ? (
            <p className="nutrition-page__hint">
              Распознали: {formatNutritionIngredientIds(recognizedPreview.ingredientIds)}
            </p>
          ) : null}
          {unrecognizedProducts.length > 0 ? (
            <p className="nutrition-page__hint nutrition-page__hint--warn">
              Не нашли в каталоге: {unrecognizedProducts.join(", ")}
            </p>
          ) : null}
          <div className="nutrition-page__actions">
            <button
              type="button"
              className="nutrition-page__btn nutrition-page__btn--primary"
              disabled={!productsText.trim() || isSaving}
              onClick={() => void handleFindRecipes()}
            >
              Подобрать рецепт
            </button>
          </div>
        </>
      ) : null}

      {step === "suggestions" ? (
        <>
          <p className="nutrition-page__hint">
            Из продуктов: {formatNutritionIngredientIds(selectedIds)}
          </p>
          {matches.some((item) => item.isFallback) ? (
            <p className="nutrition-page__fallback-note">
              Точного совпадения нет — вот универсальные варианты.
            </p>
          ) : null}
          <div className="nutrition-page__cards">
            {matches.map((match) => (
              <button
                key={match.recipe.id}
                type="button"
                className="nutrition-page__card"
                onClick={() => void handleSelectRecipe(match.recipe)}
              >
                <h2 className="nutrition-page__card-title">{match.recipe.title}</h2>
                <p className="nutrition-page__card-meta">
                  {match.recipe.summary} · {match.recipe.prepMinutes + match.recipe.cookMinutes} мин · ~
                  {match.recipe.caloriesPerServing} ккал
                </p>
                <p className="nutrition-page__card-meta">
                  Используете {match.matchedRequired} из {match.totalRequired} продуктов
                </p>
              </button>
            ))}
          </div>
          <div className="nutrition-page__actions">
            <button
              type="button"
              className="nutrition-page__btn nutrition-page__btn--secondary"
              onClick={() => setStep("ingredients")}
            >
              Изменить продукты
            </button>
          </div>
        </>
      ) : null}

      {step === "recipe" && activeRecipe ? (
        <>
          <div className="nutrition-page__recipe-meta">
            <span>{NUTRITION_MEAL_LABELS[activeRecipe.meal]}</span>
            <span>{NUTRITION_METHOD_LABELS[activeRecipe.method]}</span>
            <span>{activeRecipe.prepMinutes + activeRecipe.cookMinutes} мин</span>
            <span>~{activeRecipe.caloriesPerServing} ккал</span>
          </div>
          <p>{activeRecipe.summary}</p>
          <h2>Ингредиенты</h2>
          <ul className="nutrition-page__ingredients">
            {activeRecipe.ingredients.map((item) => {
              const has = selectedSet.has(item.id) || item.optional;
              const label = getNutritionIngredient(item.id)?.label ?? item.id;
              return (
                <li
                  key={`${item.id}-${item.amount}`}
                  className={has ? undefined : "nutrition-page__ingredient--missing"}
                >
                  {label} — {item.amount}
                  {!has ? " (нет у вас)" : ""}
                </li>
              );
            })}
          </ul>
          <h2>Приготовление</h2>
          <ol className="nutrition-page__steps">
            {activeRecipe.steps.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ol>
          <div className="nutrition-page__actions">
            <button
              type="button"
              className="nutrition-page__btn nutrition-page__btn--secondary"
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
          </div>
        </>
      ) : null}
    </div>
  );
}
