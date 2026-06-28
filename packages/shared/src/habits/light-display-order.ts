import type { HabitCategoryKey, HabitTemplateId } from "../constants/habits.js";
import {
  EARLY_RISE_HABIT_NAME,
  FOREIGN_LANGUAGE_HABIT_NAME,
  MEDITATION_HABIT_NAME,
  NUTRITION_HABIT_NAME,
} from "../constants/sessions.js";
import { isStrengthWorkoutHabit } from "./category.js";

/**
 * Порядок светлых привычек на Today.
 *
 * Утро (до работы): подъём → медитация → питание (завтрак).
 * Рабочий день ~9 ч — не сужаем, привычки ниже для «после работы».
 * После работы: разминка → бег → силовая → планка.
 * До ужина: умственные задачи (пока не поели).
 * Вечер: благодарность → чтение → ходьба.
 */
export const LIGHT_HABIT_DISPLAY_ORDER = [
  "early_rise",
  "meditation",
  "healthy_nutrition",
  "stretching",
  "template:running",
  "strength_workout",
  "template:plank",
  "language",
  "programming",
  "creative_project",
  "gratitude",
  "template:books",
  "walking",
] as const;

export type LightHabitSortSource = {
  name: string;
  template_id?: HabitTemplateId | null;
  category_key?: HabitCategoryKey | null;
};

const NAME_TO_ORDER_KEY: Record<string, string> = {
  [EARLY_RISE_HABIT_NAME]: "early_rise",
  [MEDITATION_HABIT_NAME]: "meditation",
  [NUTRITION_HABIT_NAME]: "healthy_nutrition",
  [FOREIGN_LANGUAGE_HABIT_NAME]: "language",
  "Дневник благодарности": "gratitude",
  "Силовая тренировка": "strength_workout",
  "Разминка": "stretching",
  "Растяжка": "stretching",
  "Программирование": "programming",
  "Творческий проект": "creative_project",
  "Ходьба на свежем воздухе": "walking",
  "Чтение книг": "template:books",
  "Бег": "template:running",
  "Планка": "template:plank",
};

export function resolveLightHabitDisplayOrderKey(source: LightHabitSortSource): string {
  if (source.category_key) {
    return source.category_key;
  }

  if (isStrengthWorkoutHabit(source)) {
    return "strength_workout";
  }

  if (source.template_id) {
    return `template:${source.template_id}`;
  }

  const trimmedName = source.name.trim();
  return NAME_TO_ORDER_KEY[trimmedName] ?? `name:${trimmedName.toLowerCase()}`;
}

function displayOrderIndex(key: string): number {
  const index = LIGHT_HABIT_DISPLAY_ORDER.indexOf(
    key as (typeof LIGHT_HABIT_DISPLAY_ORDER)[number],
  );
  return index === -1 ? LIGHT_HABIT_DISPLAY_ORDER.length : index;
}

export function compareLightHabitsForDisplay(
  left: LightHabitSortSource,
  right: LightHabitSortSource,
): number {
  const leftIndex = displayOrderIndex(resolveLightHabitDisplayOrderKey(left));
  const rightIndex = displayOrderIndex(resolveLightHabitDisplayOrderKey(right));
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }
  return left.name.localeCompare(right.name, "ru");
}

export function sortLightHabitsForDisplay<T extends LightHabitSortSource>(habits: T[]): T[] {
  return [...habits].sort(compareLightHabitsForDisplay);
}
