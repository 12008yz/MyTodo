import type { CreateHabitRequest, Gender, HabitTemplateId } from "@mytodo/shared";

export type OnboardingStepId =
  | "welcome"
  | "register"
  | "light"
  | "dark"
  | "body"
  | "harshness"
  | "finale";

export type SelectedTemplateHabit = {
  kind: "template";
  templateId: HabitTemplateId;
  baseline: string;
};

export type SelectedCustomHabit = {
  kind: "custom";
  name: string;
  unit: "minutes" | "pages" | "reps" | "lessons";
  baseline: string;
};

export type SelectedHabit = SelectedTemplateHabit | SelectedCustomHabit;

export type RegisterFormData = {
  name: string;
  email: string;
  password: string;
  age: string;
  gender: Gender;
};

export type BodyFormData = {
  weightKg: string;
  heightCm: string;
  wakeTime: string;
  sleepTime: string;
  freeTimeMin: number;
};

export type OnboardingDraft = {
  lightHabits: SelectedHabit[];
  darkHabits: SelectedHabit[];
  body: BodyFormData;
  harshnessLevel: 1 | 2 | 3;
  englishEnabled: boolean;
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
  };
}
