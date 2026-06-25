import type { CreateHabitRequest, HabitCategoryKey, HabitTemplateId } from "@mytodo/shared";

export type OnboardingStepId =
  | "welcome"
  | "light"
  | "dark"
  | "body"
  | "harshness"
  | "finale";

export type LightPathId = "mindfulness" | "strength" | "creator" | "energy";

export type SelectedTemplateHabit = {
  kind: "template";
  templateId: HabitTemplateId;
  baseline: string;
  practicesNow?: boolean;
  pathId?: LightPathId;
  activityId?: string;
};

export type SelectedCustomHabit = {
  kind: "custom";
  name: string;
  unit: "minutes" | "pages" | "reps" | "lessons";
  baseline: string;
  categoryKey?: HabitCategoryKey;
  practicesNow?: boolean;
  pathId?: LightPathId;
  activityId?: string;
};

export type SelectedHabit = SelectedTemplateHabit | SelectedCustomHabit;

export type BodyFormData = {
  age: string;
  gender: "male" | "female" | null;
  weightKg: string;
  heightCm: string;
  wakeTime: string;
  sleepTime: string;
  freeTimeMin: number;
};

export function toCreateHabitRequest(habit: SelectedHabit): CreateHabitRequest {
  if (habit.kind === "template") {
    const baseline = Number(habit.baseline.replace(",", "."));
    return {
      template_id: habit.templateId,
      baseline_value: Number.isFinite(baseline) ? baseline : 0,
    };
  }

  return {
    name: habit.name.trim(),
    unit: habit.unit,
    baseline_value: Number(habit.baseline.replace(",", ".")),
    category_key: habit.categoryKey,
  };
}
