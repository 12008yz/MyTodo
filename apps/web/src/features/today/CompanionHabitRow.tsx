import { useNavigate } from "react-router-dom";
import type { HabitNutritionLog, TodayLightHabit } from "@mytodo/shared";
import { getNutritionRecipe, isCompanionLightHabit } from "@mytodo/shared";
import { formatGoalLabel } from "./format";
import { HabitIcon } from "./HabitIcon";

type CompanionHabitRowProps = {
  habit: TodayLightHabit;
  nutritionLog?: HabitNutritionLog | null;
};

function nutritionLogForHabit(habit: TodayLightHabit): HabitNutritionLog | null {
  return "nutrition_log" in habit ? (habit.nutrition_log ?? null) : null;
}

export function CompanionHabitRow({ habit, nutritionLog: nutritionLogProp }: CompanionHabitRowProps) {
  const navigate = useNavigate();
  const nutritionLog = nutritionLogProp ?? nutritionLogForHabit(habit);
  const recipeTitle = nutritionLog?.recipe_id
    ? getNutritionRecipe(nutritionLog.recipe_id)?.title
    : null;
  const buttonLabel = recipeTitle ? "Открыть рецепт" : "Подобрать рецепт";

  if (!isCompanionLightHabit(habit)) {
    return null;
  }

  return (
    <article className="home__plan-item home__plan-item--companion">
      <div className="home__plan-item-head">
        <HabitIcon
          icon={habit.icon}
          side="light"
          template_id={habit.template_id}
          category_key={habit.category_key}
          name={habit.name}
        />
        <div className="home__plan-item-main">
          <h3 className="home__plan-item-title">{habit.name}</h3>
          <p className="home__plan-item-hint">{formatGoalLabel(habit)}</p>
          {recipeTitle ? (
            <p className="home__plan-item-hint home__plan-item-hint--muted">
              Последний рецепт: {recipeTitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="home__plan-item-actions">
        <button
          type="button"
          className="home__task-btn home__task-btn--start"
          onClick={() => navigate(`/habits/${habit.id}/nutrition`)}
        >
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}
