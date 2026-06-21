import { HABIT_TEMPLATES, type HabitTemplateId } from "@mytodo/shared";
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
  emoji?: string;
  hint?: string;
  description?: string;
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
    emoji: "🧘",
    hint: "Минут в день",
    name: "Медитация",
    unit: "minutes",
  },
  {
    id: "mindfulness-books",
    pathId: "mindfulness",
    kind: "template",
    label: "Чтение книг",
    emoji: "📚",
    hint: "Страниц в день",
    templateId: "books",
  },
  {
    id: "mindfulness-language",
    pathId: "mindfulness",
    kind: "custom",
    label: "Иностранный язык",
    emoji: "🗣️",
    hint: "Минут в день",
    description: "Английский — самый лёгкий язык, его и учим",
    name: "Иностранный язык",
    unit: "minutes",
  },
  {
    id: "mindfulness-gratitude",
    pathId: "mindfulness",
    kind: "custom",
    label: "Дневник благодарности",
    emoji: "📝",
    hint: "Минут в день",
    description: "Запиши 3–5 вещей, за которые благодарен",
    name: "Дневник благодарности",
    unit: "minutes",
  },
  {
    id: "strength-workout",
    pathId: "strength",
    kind: "custom",
    label: "Силовая тренировка",
    emoji: "🏋️",
    hint: "Повторений в день",
    name: "Силовая тренировка",
    unit: "reps",
  },
  {
    id: "strength-running",
    pathId: "strength",
    kind: "template",
    label: "Бег",
    emoji: "🏃",
    hint: "Минут в день",
    templateId: "running",
  },
  {
    id: "strength-plank",
    pathId: "strength",
    kind: "template",
    label: "Планка",
    emoji: "🧱",
    hint: "Секунд в день",
    templateId: "plank",
  },
  {
    id: "strength-stretch",
    pathId: "strength",
    kind: "custom",
    label: "Растяжка",
    emoji: "🤸",
    hint: "Минут в день",
    name: "Растяжка",
    unit: "minutes",
  },
  {
    id: "creator-programming",
    pathId: "creator",
    kind: "custom",
    label: "Программирование",
    emoji: "💻",
    hint: "Минут в день",
    name: "Программирование",
    unit: "minutes",
  },
  {
    id: "creator-skill",
    pathId: "creator",
    kind: "custom",
    label: "Изучение нового навыка",
    emoji: "🎯",
    hint: "Минут в день",
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
    emoji: "🚶",
    hint: "Минут в день",
    name: "Ходьба на свежем воздухе",
    unit: "minutes",
  },
  {
    id: "energy-early",
    pathId: "energy",
    kind: "custom",
    label: "Ранний подъём",
    emoji: "🌅",
    hint: "Минут утренней рутины",
    name: "Ранний подъём",
    unit: "minutes",
  },
  {
    id: "energy-hobby",
    pathId: "energy",
    kind: "custom",
    label: "Творчество / Хобби",
    emoji: "🎨",
    hint: "Минут в день",
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
    if (template.unit === "pages") return "Сколько страниц в день?";
    if (template.unit === "reps") return "Сколько раз в день?";
    if (template.unit === "seconds") return "Сколько секунд в день?";
    return "Сколько минут в день?";
  }

  return "Сколько в день?";
}

export function getAmountQuestion(habit: SelectedHabit, practicesNow: boolean): string {
  const unit = habit.kind === "template"
    ? HABIT_TEMPLATES[habit.templateId].unit
    : habit.unit;

  if (practicesNow) {
    if (unit === "pages") return "Сколько страниц занимаешься сейчас в день?";
    if (unit === "reps") return "Сколько повторений делаешь сейчас в день?";
    if (unit === "seconds") return "Сколько секунд занимаешься сейчас в день?";
    if (unit === "lessons") return "Сколько уроков проходишь сейчас в день?";
    return "Сколько минут занимаешься сейчас в день?";
  }

  if (unit === "pages") return "Сколько страниц хочешь читать в день?";
  if (unit === "reps") return "Сколько повторений хочешь делать в день?";
  if (unit === "seconds") return "Сколько секунд хочешь заниматься в день?";
  if (unit === "lessons") return "Сколько уроков хочешь проходить в день?";
  return "Сколько минут хочешь заниматься в день?";
}

export function getActivityEmoji(activity: LightActivity): string {
  if (activity.kind !== "custom_form" && activity.emoji) {
    return activity.emoji;
  }
  return "✨";
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
): SelectedHabit[] {
  if (activity.kind === "custom_form") {
    return habits;
  }

  const existing = findHabitByActivityId(habits, activity.id);
  if (existing) {
    return habits.filter((habit) => habit.activityId !== activity.id);
  }

  return [...habits, createHabitFromActivity(activity)];
}

export function addCreatorCustomHabit(
  habits: SelectedHabit[],
  input: { name: string; unit: SelectedCustomHabit["unit"] },
): { habits: SelectedHabit[]; error: string | null } {
  if (!input.name.trim()) {
    return { habits, error: "Укажи название занятия" };
  }

  const activityId = `creator-custom-${Date.now()}`;

  return {
    habits: [
      ...habits,
      {
        kind: "custom",
        name: input.name.trim(),
        unit: input.unit,
        baseline: "0",
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

export function getDefaultLightBaseline(habit: SelectedHabit): string {
  if (habit.activityId === "mindfulness-meditation") {
    return "5";
  }
  return "0";
}

export function getLightHabitSummary(habit: SelectedHabit): string {
  if (habit.practicesNow === false) {
    if (habit.activityId === "mindfulness-meditation") {
      return "5 мин/день";
    }
    return "Рост понемногу";
  }

  if (habit.practicesNow === true && isLightBaselineValid(habit.baseline)) {
    const unit =
      habit.kind === "template"
        ? HABIT_TEMPLATES[habit.templateId].unit
        : habit.unit;
    const label =
      unit === "pages"
        ? "стр"
        : unit === "minutes"
          ? "мин"
          : unit === "reps"
            ? "раз"
            : unit === "seconds"
              ? "сек"
              : unit === "lessons"
                ? "ур"
                : unit;
    return `Сейчас: ${habit.baseline} ${label}/день`;
  }

  return "";
}

export function isLightBaselineValid(value: string): boolean {
  if (value.trim() === "") return false;
  const baseline = Number(value.replace(",", "."));
  return Number.isFinite(baseline) && baseline >= 0;
}

export function setLightPracticesNow(
  habits: SelectedHabit[],
  activityId: string,
  practicesNow: boolean,
): SelectedHabit[] {
  return habits.map((habit) => {
    if (habit.activityId !== activityId) return habit;

    if (practicesNow) {
      return { ...habit, practicesNow: true, baseline: "" };
    }

    return {
      ...habit,
      practicesNow: false,
      baseline: getDefaultLightBaseline(habit),
    };
  });
}

export function isLightSetupComplete(habit: SelectedHabit): boolean {
  if (habit.practicesNow === undefined) return false;
  if (habit.practicesNow === false) return true;
  return isLightBaselineValid(habit.baseline);
}

export function validateLightHabits(habits: SelectedHabit[]): string | null {
  if (habits.length === 0) {
    return "Выбери хотя бы одну суперсилу на Пути роста";
  }

  for (const habit of habits) {
    if (!isLightSetupComplete(habit)) {
      if (habit.practicesNow === undefined) {
        return `Ответь, занимаешься ли сейчас «${getHabitDisplayName(habit)}»`;
      }
      return `Укажи, сколько занимаешься «${getHabitDisplayName(habit)}»`;
    }
  }

  return null;
}
