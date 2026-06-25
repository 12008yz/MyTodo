import { HABIT_TEMPLATES, type HabitCategoryKey, type HabitTemplateId } from "@mytodo/shared";
import {
  estimateHabitsComfortMinutesWithSetup,
  formatEarlyRiseTargetWakeTime,
  formatHabitComfortLabel,
  formatHabitComfortLabelWithSetup,
  type HabitComfortSetup,
  type HabitIdentity,
} from "@mytodo/domain";
import type { LightPathId, SelectedCustomHabit, SelectedHabit } from "./types";

export type { LightPathId } from "./types";

export type LightPath = {
  id: LightPathId;
  title: string;
  powers: string;
  description: string;
};

export const LIGHT_PATHS: LightPath[] = [
  {
    id: "mindfulness",
    title: "Путь Осознанности",
    powers: "фокус и гармония",
    description: "Для тех, кто хочет ясности и внутреннего покоя.",
  },
  {
    id: "strength",
    title: "Путь Силы",
    powers: "мощь и дисциплина",
    description: "Для тех, кто хочет стать крепче и увереннее.",
  },
  {
    id: "creator",
    title: "Путь Творца",
    powers: "креатив и мастерство",
    description: "Для тех, кто создаёт новое и прокачивает навыки.",
  },
  {
    id: "energy",
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

export const LIGHT_PATH_STEP_HERO = "/iconsApp/man-with-todo-clipboard.png";

type LightActivityBase = {
  id: string;
  pathId: LightPathId;
  label: string;
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
  categoryKey?: HabitCategoryKey;
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
    hint: "Минут в день",
    name: "Медитация",
    unit: "minutes",
    categoryKey: "meditation",
  },
  {
    id: "mindfulness-books",
    pathId: "mindfulness",
    kind: "template",
    label: "Чтение книг",
    hint: "Страниц в день",
    templateId: "books",
  },
  {
    id: "mindfulness-language",
    pathId: "mindfulness",
    kind: "custom",
    label: "Иностранный язык",
    hint: "Минут в день",
    description: "Английский — самый лёгкий язык, его и учим",
    name: "Иностранный язык",
    unit: "minutes",
    categoryKey: "language",
  },
  {
    id: "mindfulness-gratitude",
    pathId: "mindfulness",
    kind: "custom",
    label: "Дневник благодарности",
    hint: "Минут в день",
    description: "Запиши 3–5 вещей, за которые благодарен",
    name: "Дневник благодарности",
    unit: "minutes",
    categoryKey: "gratitude",
  },
  {
    id: "strength-workout",
    pathId: "strength",
    kind: "custom",
    label: "Силовая тренировка",
    hint: "Повторений в день",
    description: "Упражнения под твой вес, рост и возраст",
    name: "Силовая тренировка",
    unit: "reps",
    categoryKey: "strength_workout",
  },
  {
    id: "strength-running",
    pathId: "strength",
    kind: "template",
    label: "Бег",
    hint: "Минут в день",
    description: "Время и темп бега под твой уровень",
    templateId: "running",
  },
  {
    id: "strength-plank",
    pathId: "strength",
    kind: "template",
    label: "Планка",
    hint: "Секунд в день",
    description: "Длительность планки под вес и форму",
    templateId: "plank",
  },
  {
    id: "strength-stretch",
    pathId: "strength",
    kind: "custom",
    label: "Растяжка",
    hint: "Минут в день",
    description: "Растяжка под твои цели и гибкость",
    name: "Растяжка",
    unit: "minutes",
    categoryKey: "stretching",
  },
  {
    id: "creator-programming",
    pathId: "creator",
    kind: "custom",
    label: "Программирование",
    hint: "Минут в день",
    description: "С чего начать код под твой уровень",
    name: "Программирование",
    unit: "minutes",
    categoryKey: "programming",
  },
  {
    id: "creator-creative",
    pathId: "creator",
    kind: "custom",
    label: "Творческий проект",
    hint: "Минут в день",
    description: "Первый шаг в рисовании, музыке или дизайне",
    name: "Творческий проект",
    unit: "minutes",
    categoryKey: "creative_project",
  },
  {
    id: "creator-custom",
    pathId: "creator",
    kind: "custom_form",
    label: "+ Своё занятие",
    hint: "Blender, 3D, музыка, дизайн…",
    description: "Назови идею — подскажем, с чего начать",
  },
  {
    id: "energy-walk",
    pathId: "energy",
    kind: "custom",
    label: "Ходьба на свежем воздухе",
    hint: "Минут в день",
    name: "Ходьба на свежем воздухе",
    unit: "minutes",
    categoryKey: "walking",
  },
  {
    id: "energy-early",
    pathId: "energy",
    kind: "custom",
    label: "Ранний подъём",
    hint: "Сдвиг подъёма",
    description: "Если встаёшь в 7:00 — сначала цель 6:55",
    name: "Ранний подъём",
    unit: "minutes",
    categoryKey: "early_rise",
  },
  {
    id: "energy-hobby",
    pathId: "energy",
    kind: "custom",
    label: "Творчество / Хобби",
    hint: "Минут в день",
    name: "Творчество / Хобби",
    unit: "minutes",
    categoryKey: "hobby",
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
    categoryKey: activity.categoryKey,
    baseline: activity.categoryKey === "early_rise" ? "5" : "",
    pathId: activity.pathId,
    activityId: activity.id,
    practicesNow: activity.categoryKey === "early_rise" ? false : undefined,
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
    return "1";
  }
  if (habit.activityId === "mindfulness-books") {
    return "0";
  }
  return "0";
}

export function getActivityComfortLabel(activity: LightActivity): string | null {
  if (activity.kind === "custom_form") {
    return null;
  }

  if (activity.kind === "template") {
    const template = HABIT_TEMPLATES[activity.templateId];
    return formatHabitComfortLabel({
      name: template.name,
      unit: template.unit,
      templateId: activity.templateId,
    });
  }

  return formatHabitComfortLabel({
    name: activity.name,
    unit: activity.unit,
    categoryKey: activity.categoryKey,
  });
}

export function selectedHabitToIdentity(habit: SelectedHabit): HabitIdentity {
  if (habit.kind === "template") {
    const template = HABIT_TEMPLATES[habit.templateId];
    return {
      name: template.name,
      unit: template.unit,
      templateId: habit.templateId,
    };
  }

  return {
    name: habit.name,
    unit: habit.unit,
    categoryKey: habit.categoryKey,
  };
}

function selectedHabitToComfortSetup(habit: SelectedHabit): HabitComfortSetup {
  return {
    habit: selectedHabitToIdentity(habit),
    practicesNow: habit.practicesNow,
    baselineValue: isLightBaselineValid(habit.baseline)
      ? Number(habit.baseline.replace(",", "."))
      : undefined,
  };
}

export function getHabitComfortLabel(habit: SelectedHabit): string {
  return formatHabitComfortLabelWithSetup(selectedHabitToComfortSetup(habit));
}

export function estimateLightHabitsComfortMinutes(habits: SelectedHabit[]): number {
  return estimateHabitsComfortMinutesWithSetup(habits.map(selectedHabitToComfortSetup));
}

export function getEarlyRiseSummary(habit: SelectedHabit, wakeTime: string): string {
  if (habit.kind === "custom" && habit.categoryKey === "early_rise") {
    const shift = habit.practicesNow === false ? 5 : Number(habit.baseline) || 5;
    return `Цель: ${formatEarlyRiseTargetWakeTime(wakeTime, shift)}`;
  }

  return "Раньше на 5 мин";
}

export function getLightHabitSummary(habit: SelectedHabit, wakeTime?: string): string {
  if (habit.kind === "custom" && habit.categoryKey === "early_rise" && wakeTime) {
    return getEarlyRiseSummary(habit, wakeTime);
  }

  if (habit.practicesNow === false) {
    if (habit.activityId === "mindfulness-meditation") {
      return "1 мин/день";
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
  if (habit.kind === "custom" && habit.categoryKey === "early_rise") {
    return true;
  }

  if (habit.practicesNow === undefined) return false;
  if (habit.practicesNow === false) return true;
  return isLightBaselineValid(habit.baseline);
}

export function keepCompleteLightHabits(habits: SelectedHabit[]): SelectedHabit[] {
  return habits.filter(isLightSetupComplete);
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
