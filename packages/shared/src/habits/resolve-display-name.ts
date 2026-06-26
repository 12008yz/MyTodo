import { HABIT_TEMPLATES, type HabitTemplateId } from "../constants/habits.js";

export type HabitDisplayNameSource = {
  name: string;
  template_id?: HabitTemplateId | null;
  is_custom?: boolean;
};

/** Template habits always show the current catalog name; custom habits keep user text. */
export function resolveHabitDisplayName(source: HabitDisplayNameSource): string {
  if (source.is_custom || !source.template_id) {
    return source.name;
  }

  return HABIT_TEMPLATES[source.template_id]?.name ?? source.name;
}
