import {
  EARLY_RISE_HABIT_NAME,
  FOREIGN_LANGUAGE_HABIT_NAME,
  MEDITATION_HABIT_NAME,
  NUTRITION_HABIT_NAME,
} from "../constants/sessions.js";
import {
  HABIT_TEMPLATES,
  type HabitCategoryKey,
  type HabitSide,
  type HabitTemplateId,
} from "../constants/habits.js";

export const HABIT_CATEGORY_ICONS: Record<HabitCategoryKey, string> = {
  meditation: "🧘",
  language: "🗣️",
  gratitude: "✨",
  strength_workout: "🏋️",
  stretching: "🤸",
  programming: "💻",
  creative_project: "🎨",
  walking: "🚶",
  early_rise: "🌅",
  healthy_nutrition: "🥗",
};

const HABIT_NAME_ICONS: Record<string, string> = {
  [MEDITATION_HABIT_NAME]: HABIT_CATEGORY_ICONS.meditation,
  [FOREIGN_LANGUAGE_HABIT_NAME]: HABIT_CATEGORY_ICONS.language,
  "Дневник благодарности": HABIT_CATEGORY_ICONS.gratitude,
  "Силовая тренировка": HABIT_CATEGORY_ICONS.strength_workout,
  "Разминка": HABIT_CATEGORY_ICONS.stretching,
  "Растяжка": HABIT_CATEGORY_ICONS.stretching,
  "Программирование": HABIT_CATEGORY_ICONS.programming,
  "Творческий проект": HABIT_CATEGORY_ICONS.creative_project,
  "Ходьба на свежем воздухе": HABIT_CATEGORY_ICONS.walking,
  [EARLY_RISE_HABIT_NAME]: HABIT_CATEGORY_ICONS.early_rise,
  [NUTRITION_HABIT_NAME]: HABIT_CATEGORY_ICONS.healthy_nutrition,
};

export type HabitIconSource = {
  icon?: string | null;
  template_id?: HabitTemplateId | null;
  category_key?: HabitCategoryKey | null;
  name?: string | null;
  side?: HabitSide;
};

function hasIcon(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveHabitIcon(source: HabitIconSource): string | null {
  if (hasIcon(source.icon)) {
    return source.icon.trim();
  }

  if (source.template_id) {
    const template = HABIT_TEMPLATES[source.template_id];
    if (template?.icon) {
      return template.icon;
    }
  }

  if (source.category_key) {
    const categoryIcon = HABIT_CATEGORY_ICONS[source.category_key];
    if (categoryIcon) {
      return categoryIcon;
    }
  }

  const name = source.name?.trim();
  if (name && HABIT_NAME_ICONS[name]) {
    return HABIT_NAME_ICONS[name];
  }

  return null;
}
