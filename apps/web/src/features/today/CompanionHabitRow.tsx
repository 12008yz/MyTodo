import { useEffect, useState, type MouseEvent } from "react";
import type { HabitNutritionLog, TodayLightHabit } from "@mytodo/shared";
import { getNutritionRecipe, isCompanionLightHabit } from "@mytodo/shared";
import { CollapsibleReveal } from "../../components/CollapsibleReveal";
import { formatGoalLabel } from "./format";
import { HabitIcon } from "./HabitIcon";
import { NutritionPickerDrawer } from "./NutritionPickerDrawer";

type CompanionHabitRowProps = {
  habit: TodayLightHabit;
  nutritionLog?: HabitNutritionLog | null;
};

function PlanInfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 8.25V13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="9" cy="5.75" r="0.9" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : undefined }}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function nutritionLogForHabit(habit: TodayLightHabit): HabitNutritionLog | null {
  return "nutrition_log" in habit ? (habit.nutrition_log ?? null) : null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "button, a, input, label, textarea, .home__nutrition-picker, .home__nutrition-products",
      ),
    )
  );
}

export function CompanionHabitRow({ habit, nutritionLog: nutritionLogProp }: CompanionHabitRowProps) {
  const nutritionLog = nutritionLogProp ?? nutritionLogForHabit(habit);
  const recipeTitle = nutritionLog?.recipe_id
    ? getNutritionRecipe(nutritionLog.recipe_id)?.title
    : null;
  const [expanded, setExpanded] = useState(false);
  const [expandedLook, setExpandedLook] = useState(false);
  const [drawerKey, setDrawerKey] = useState(0);
  const [openToSavedRecipe, setOpenToSavedRecipe] = useState(false);

  useEffect(() => {
    if (expanded) {
      setExpandedLook(true);
    }
  }, [expanded]);

  if (!isCompanionLightHabit(habit)) {
    return null;
  }

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    setOpenToSavedRecipe(false);
    setExpanded((value) => !value);
  };

  const openDrawer = (event: MouseEvent<HTMLButtonElement>, showSavedRecipe = false) => {
    event.stopPropagation();
    setOpenToSavedRecipe(showSavedRecipe);
    if (showSavedRecipe) {
      setDrawerKey((key) => key + 1);
    }
    setExpanded(true);
  };

  return (
    <article
      className={[
        "home__plan-item",
        expandedLook ? "home__plan-item--expanded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        if (isInteractiveTarget(event.target)) {
          return;
        }
        event.preventDefault();
        setOpenToSavedRecipe(false);
        setExpanded((value) => !value);
      }}
    >
      <header className="home__plan-item-header">
        <h3 className="home__plan-item-title">
          <HabitIcon
            icon={habit.icon}
            side="light"
            template_id={habit.template_id}
            category_key={habit.category_key}
            name={habit.name}
          />
          <span className="home__plan-item-name">{habit.name}</span>
        </h3>
        <span className="home__plan-badge home__plan-badge--utility">Идеи ПП</span>
      </header>

      <p className="home__plan-item-goal">{formatGoalLabel(habit)}</p>

      {recipeTitle ? (
        <p className="home__plan-item-hint home__plan-item-hint--muted">
          Последний рецепт: {recipeTitle}
        </p>
      ) : null}

      <div className="home__task-actions">
        <button
          type="button"
          className="home__task-btn home__task-btn--start"
          onClick={(event) => openDrawer(event, Boolean(recipeTitle))}
        >
          {recipeTitle ? "Открыть рецепт" : "Рецепты"}
        </button>

        <button
          type="button"
          className="home__plan-expand-btn"
          aria-expanded={expanded}
          aria-label={expanded ? "Свернуть" : "Развернуть"}
          onClick={(event) => {
            event.stopPropagation();
            setOpenToSavedRecipe(false);
            setExpanded((value) => !value);
          }}
        >
          <ChevronIcon className="home__plan-expand-btn-icon" open={expanded} />
        </button>
      </div>

      <CollapsibleReveal
        open={expanded}
        scrollBehavior="none"
        onCollapsed={() => {
          setExpandedLook(false);
          setOpenToSavedRecipe(false);
          setDrawerKey((key) => key + 1);
        }}
        className="home__plan-item-drawer"
        contentClassName="home__plan-item-drawer-inner"
      >
        <div className="home__plan-item-drawer-body">
          <p className="home__plan-item-drawer-title">
            <PlanInfoIcon className="home__plan-item-drawer-icon" />
            Подбор ПП-рецепта
          </p>
          <p className="home__plan-item-drawer-text home__nutrition-intro">
            Сначала — идеи на сегодня. Укажите ваши продукты ниже
          </p>
          <NutritionPickerDrawer
            key={drawerKey}
            initialLog={openToSavedRecipe ? nutritionLog : null}
            openToSavedRecipe={openToSavedRecipe}
          />
        </div>
      </CollapsibleReveal>
    </article>
  );
}
