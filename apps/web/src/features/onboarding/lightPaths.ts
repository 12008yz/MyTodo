import { HABIT_TEMPLATES, MAX_ACTIVE_HABITS, type HabitTemplateId } from "@mytodo/shared";
import type { LightPathId, SelectedCustomHabit, SelectedHabit } from "./types";

export type { LightPathId } from "./types";

export type LightPath = {
  id: LightPathId;
  emoji: string;
  title: string;
  powers: string;
  description: string;
};

export const LIGHT_PATHS: LightPath[] = [
  {
    id: "mindfulness",
    emoji: "🧘",
    title: "Путь Осознанности",
    powers: "фокус и гармония",
    description: "Для тех, кто хочет ясности и внутреннего покоя.",
  },
  {
    id: "strength",
    emoji: "💪",
    title: "Путь Силы",
    powers: "мощь и дисциплина",
    description: "Для тех, кто хочет стать крепче и увереннее.",
  },
  {
    id: "creator",
    emoji: "🧠",
    title: "Путь Творца",
    powers: "креатив и мастерство",
    description: "Для тех, кто создаёт новое и прокачивает навыки.",
  },
  {
    id: "energy",
    emoji: "🔥",
    title: "Путь Энергии",
    powers: "энергия и позитив",
    description: "Для тех, кто хочет драйв и лёгкость каждый день.",
  },
];

export const LIGHT_PATH_TAB_LABELS: Record<LightPathId, string> = {
  mindfulness: "Осознанность",
  strength: "Сила",
  creator: "Творец",
  energy: "Энергия",
};

type LightActivityBase = {
  id: string;
  pathId: LightPathId;
  label: string;
  hint?: string;
};

export type LightActivityTemplate = LightActivityBase & {
  kind: "template";
  templateId: HabitTemplateId;
};

export type LightActivityCustom = LightActivityBase & {
  kind: "custom";
  name: string;
  unit: SelectedCustomHabit["unit"];
};

export type LightActivityCustomForm = LightActivityBase & {
  kind: "custom_form";
};

export type LightActivity =
  | LightActivityTemplate
  | LightActivityCustom
  | LightActivityCustomForm;

export const LIGHT_ACTIVITIES: LightActivity[] = [
  {
    id: "mindfulness-meditation",
    pathId: "mindfulness",
    kind: "custom",
    label: "Медитация",
    hint: "Сколько минут в день сейчас?",
    name: "Медитация",
    unit: "minutes",
  },
  {
    id: "mindfulness-books",
    pathId: "mindfulness",
    kind: "template",
    label: "Читать книги",
    hint: "Сколько страниц в день сейчас?",
    templateId: "books",
  },
  {
    id: "mindfulness-language",
    pathId: "mindfulness",
    kind: "custom",
    label: "Иностранный язык",
    hint: "Сколько минут в день сейчас?",
    name: "Иностранный язык",
    unit: "minutes",
  },
  {
    id: "mindfulness-gratitude",
    pathId: "mindfulness",
    kind: "custom",
    label: "Дневник благодарности",
    hint: "Сколько минут в день сейчас?",
    name: "Дневник благодарности",
    unit: "minutes",
  },
  {
    id: "strength-workout",
    pathId: "strength",
    kind: "custom",
    label: "Силовая тренировка",
    hint: "Сколько повторений в день сейчас? (отжимания, приседания, пресс)",
    name: "Силовая тренировка",
    unit: "reps",
  },
  {
    id: "strength-running",
    pathId: "strength",
    kind: "template",
    label: "Бег",
    hint: "Сколько минут бега или кардио в день сейчас?",
    templateId: "running",
  },
  {
    id: "strength-plank",
    pathId: "strength",
    kind: "template",
    label: "Планка",
    hint: "Сколько секунд планки или статики в день сейчас?",
    templateId: "plank",
  },
  {
    id: "strength-stretch",
    pathId: "strength",
    kind: "custom",
    label: "Растяжка",
    hint: "Сколько минут в день сейчас?",
    name: "Растяжка",
    unit: "minutes",
  },
  {
    id: "creator-programming",
    pathId: "creator",
    kind: "custom",
    label: "Программирование",
    hint: "Сколько минут в день сейчас?",
    name: "Программирование",
    unit: "minutes",
  },
  {
    id: "creator-skill",
    pathId: "creator",
    kind: "custom",
    label: "Изучение нового навыка",
    hint: "Сколько минут в день сейчас?",
    name: "Изучение нового навыка",
    unit: "minutes",
  },
  {
    id: "creator-custom",
    pathId: "creator",
    kind: "custom_form",
    label: "+ Своё занятие",
    hint: "Blender, 3D, музыка, дизайн…",
  },
  {
    id: "energy-walk",
    pathId: "energy",
    kind: "custom",
    label: "Ходьба на свежем воздухе",
    hint: "Сколько минут в день сейчас?",
    name: "Ходьба на свежем воздухе",
    unit: "minutes",
  },
  {
    id: "energy-early",
    pathId: "energy",
    kind: "custom",
    label: "Ранний подъём",
    hint: "Сколько минут утренней рутины сейчас?",
    name: "Ранний подъём",
    unit: "minutes",
  },
  {
    id: "energy-hobby",
    pathId: "energy",
    kind: "custom",
    label: "Творчество / Хобби",
    hint: "Сколько минут в день сейчас?",
    name: "Творчество / Хобби",
    unit: "minutes",
  },
];

const ACTIVITY_BY_ID = new Map(LIGHT_ACTIVITIES.map((activity) => [activity.id, activity]));

export function getActivitiesForPath(pathId: LightPathId): LightActivity[] {
  return LIGHT_ACTIVITIES.filter((activity) => activity.pathId === pathId);
}

export function findHabitByActivityId(
  habits: SelectedHabit[],
  activityId: string,
): SelectedHabit | undefined {
  return habits.find((habit) => habit.activityId === activityId);
}

export function getHabitDisplayName(habit: SelectedHabit): string {
  if (habit.activityId) {
    const activity = ACTIVITY_BY_ID.get(habit.activityId);
    if (activity && activity.kind !== "custom_form") {
      return activity.label;
    }
  }

  if (habit.kind === "template") {
    return HABIT_TEMPLATES[habit.templateId].name;
  }

  return habit.name;
}

export function getBaselineHint(habit: SelectedHabit): string {
  if (habit.activityId) {
    const activity = ACTIVITY_BY_ID.get(habit.activityId);
    if (activity?.hint) return activity.hint;
  }

  if (habit.kind === "template") {
    const template = HABIT_TEMPLATES[habit.templateId];
    if (template.unit === "pages") return "Сколько страниц в день сейчас?";
    if (template.unit === "reps") return "Сколько раз в день сейчас?";
    if (template.unit === "seconds") return "Сколько секунд в день сейчас?";
    return "Сколько минут в день сейчас?";
  }

  return "Сколько сейчас в день?";
}

function createHabitFromActivity(
  activity: LightActivityTemplate | LightActivityCustom,
): SelectedHabit {
  if (activity.kind === "template") {
    return {
      kind: "template",
      templateId: activity.templateId,
      baseline: "",
      pathId: activity.pathId,
      activityId: activity.id,
    };
  }

  return {
    kind: "custom",
    name: activity.name,
    unit: activity.unit,
    baseline: "",
    pathId: activity.pathId,
    activityId: activity.id,
  };
}

export function toggleLightActivity(
  habits: SelectedHabit[],
  activity: LightActivity,
  totalWithDark: number,
): SelectedHabit[] {
  if (activity.kind === "custom_form") {
    return habits;
  }

  const existing = findHabitByActivityId(habits, activity.id);
  if (existing) {
    return habits.filter((habit) => habit.activityId !== activity.id);
  }

  if (totalWithDark >= MAX_ACTIVE_HABITS) {
    return habits;
  }

  return [...habits, createHabitFromActivity(activity)];
}

export function addCreatorCustomHabit(
  habits: SelectedHabit[],
  input: { name: string; unit: SelectedCustomHabit["unit"]; baseline: string },
  totalWithDark: number,
): { habits: SelectedHabit[]; error: string | null } {
  if (!input.name.trim()) {
    return { habits, error: "Укажи название занятия" };
  }

  if (totalWithDark >= MAX_ACTIVE_HABITS) {
    return { habits, error: `Максимум ${MAX_ACTIVE_HABITS} привычек` };
  }

  const activityId = `creator-custom-${Date.now()}`;

  return {
    habits: [
      ...habits,
      {
        kind: "custom",
        name: input.name.trim(),
        unit: input.unit,
        baseline: input.baseline,
        pathId: "creator",
        activityId,
      },
    ],
    error: null,
  };
}

export function updateLightBaseline(
  habits: SelectedHabit[],
  activityId: string,
  baseline: string,
): SelectedHabit[] {
  return habits.map((habit) =>
    habit.activityId === activityId ? { ...habit, baseline } : habit,
  );
}

export function validateLightHabits(habits: SelectedHabit[]): string | null {
  if (habits.length === 0) {
    return "Выбери хотя бы одну суперсилу на Пути роста";
  }

  for (const habit of habits) {
    const baseline = Number(habit.baseline.replace(",", "."));
    if (!Number.isFinite(baseline) || baseline < 0) {
      return `Укажи текущий уровень для «${getHabitDisplayName(habit)}»`;
    }
  }

  return null;
}
