import { HABIT_TEMPLATES, type HabitTemplateId } from "@mytodo/shared";
import { DARK_TEMPLATE_IDS } from "./constants";
import type { SelectedHabit, SelectedTemplateHabit } from "./types";
import { getBaselineLabel, unitLabel } from "./constants";

export type DarkEnemy = {
  templateId: (typeof DARK_TEMPLATE_IDS)[number];
  unitHint: string;
  description: string;
};

export const DARK_ENEMIES: DarkEnemy[] = [
  {
    templateId: "smoking",
    unitHint: "сиг./день",
    description: "Снижаем постепенно - до полного отказа",
  },
  {
    templateId: "sugar",
    unitHint: "лож./день",
    description: "Уберём ложку за ложкой, без скачков",
  },
  {
    templateId: "sweets",
    unitHint: "шт./день",
    description: "Меньше сладкого каждый день — под твой ритм",
  },
  {
    templateId: "social_media",
    unitHint: "мин/день",
    description: "Сократим экранное время шагами по 5 минут",
  },
  {
    templateId: "nail_biting",
    unitHint: "отказ",
    description: "Полный отказ — держим линию каждый день",
  },
];

const ENEMY_BY_ID = new Map(DARK_ENEMIES.map((enemy) => [enemy.templateId, enemy]));

export const DARK_PATH_STEP_HERO = "/iconsApp/undraw_ai-slop_jm2g.svg";

export function getDarkEnemy(templateId: HabitTemplateId): DarkEnemy | undefined {
  return ENEMY_BY_ID.get(templateId as DarkEnemy["templateId"]);
}

export function isDarkAbstinence(templateId: HabitTemplateId): boolean {
  return templateId === "nail_biting";
}

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

export function isDarkBaselineValid(baseline: string): boolean {
  const parsed = parseNumber(baseline);
  return Number.isFinite(parsed) && parsed >= 0 && baseline.trim() !== "";
}

export function countBaselineDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

export function getDarkBaselineAutoCloseDigits(templateId: HabitTemplateId): number {
  return templateId === "social_media" ? 3 : 2;
}

export function shouldAutoCloseDarkBaseline(
  templateId: HabitTemplateId,
  value: string,
): boolean {
  if (!isDarkBaselineValid(value)) return false;
  return countBaselineDigits(value) >= getDarkBaselineAutoCloseDigits(templateId);
}

export function shouldCommitDarkBaselineOnBlur(
  templateId: HabitTemplateId,
  value: string,
): boolean {
  if (!isDarkBaselineValid(value)) return false;
  if (shouldAutoCloseDarkBaseline(templateId, value)) return true;
  return countBaselineDigits(value) < getDarkBaselineAutoCloseDigits(templateId);
}

export function findDarkHabit(
  habits: SelectedHabit[],
  templateId: HabitTemplateId,
): SelectedTemplateHabit | undefined {
  return habits.find(
    (habit): habit is SelectedTemplateHabit =>
      habit.kind === "template" && habit.templateId === templateId,
  );
}

export function isDarkSetupComplete(habit: SelectedTemplateHabit): boolean {
  if (isDarkAbstinence(habit.templateId)) {
    return habit.practicesNow === false;
  }
  return isDarkBaselineValid(habit.baseline);
}

export function keepCompleteDarkHabits(habits: SelectedHabit[]): SelectedHabit[] {
  return habits.filter(
    (habit) =>
      habit.kind !== "template" ||
      !DARK_TEMPLATE_IDS.includes(habit.templateId as (typeof DARK_TEMPLATE_IDS)[number]) ||
      isDarkSetupComplete(habit),
  );
}

export function toggleDarkEnemy(
  habits: SelectedHabit[],
  templateId: HabitTemplateId,
): SelectedHabit[] {
  const existing = findDarkHabit(habits, templateId);
  if (existing) {
    return habits.filter(
      (habit) => !(habit.kind === "template" && habit.templateId === templateId),
    );
  }

  return [...habits, { kind: "template", templateId, baseline: "" }];
}

export function confirmDarkAbstinence(
  habits: SelectedHabit[],
  templateId: HabitTemplateId,
): SelectedHabit[] {
  return habits.map((habit) =>
    habit.kind === "template" && habit.templateId === templateId
      ? { ...habit, baseline: "0", practicesNow: false }
      : habit,
  );
}

export function updateDarkBaseline(
  habits: SelectedHabit[],
  templateId: HabitTemplateId,
  baseline: string,
): SelectedHabit[] {
  return habits.map((habit) =>
    habit.kind === "template" && habit.templateId === templateId
      ? { ...habit, baseline, practicesNow: true }
      : habit,
  );
}

export function getDarkHabitSummary(habit: SelectedTemplateHabit): string {
  if (isDarkAbstinence(habit.templateId)) {
    return "Режим отказа";
  }

  const enemy = getDarkEnemy(habit.templateId);
  const unit = enemy?.unitHint ?? unitLabel(HABIT_TEMPLATES[habit.templateId].unit);
  return `Сейчас: ${habit.baseline} ${unit}`;
}

export function getDarkBaselineQuestion(templateId: HabitTemplateId): string {
  return getBaselineLabel(templateId);
}

export function validateDarkHabits(habits: SelectedHabit[]): string | null {
  const darkHabits = habits.filter(
    (habit): habit is SelectedTemplateHabit =>
      habit.kind === "template" &&
      DARK_TEMPLATE_IDS.includes(habit.templateId as (typeof DARK_TEMPLATE_IDS)[number]),
  );

  if (darkHabits.length === 0) {
    return "Выбери хотя бы одну привычку для контроля";
  }

  for (const habit of darkHabits) {
    if (!isDarkSetupComplete(habit)) {
      const name = HABIT_TEMPLATES[habit.templateId].name;
      if (isDarkAbstinence(habit.templateId)) {
        return `Подтверди отказ от «${name}»`;
      }
      return `Укажи текущий уровень для «${name}»`;
    }
  }

  return null;
}
