import {
  CUSTOM_MINUTES_STEP,
  EARLY_RISE_SHIFT_MIN,
  type CustomHabitUnit,
  type HabitCategoryKey,
  type HabitTemplate,
  type HabitTemplateId,
  type HabitUnit,
} from "@mytodo/shared";
import { recommendLightGoal, resolveLightActivityId, type HabitIdentity } from "./workload.js";

export type CalibrationProfile = {
  dailyBudgetMin: number;
  age: number;
  gender: "male" | "female" | "other";
  weightKg: number;
  heightCm: number;
};

export type CalibrateHabitInput =
  | {
      kind: "template";
      templateId: HabitTemplateId;
      template: HabitTemplate;
      baselineValue: number;
      profile: CalibrationProfile;
      activeLightHabitsIncludingNew: number;
      now?: Date;
    }
  | {
      kind: "custom";
      name: string;
      unit: CustomHabitUnit;
      baselineValue: number;
      categoryKey?: HabitCategoryKey;
      profile: CalibrationProfile;
      activeLightHabitsIncludingNew: number;
      icon?: string;
      now?: Date;
    };

export type CalibratedHabit = {
  name: string;
  type: "target" | "limit" | "abstinence";
  side: "light" | "dark";
  unit: HabitUnit;
  baselineValue: number;
  currentGoal: number;
  growthStep: number;
  progressionDirection: "increase" | "decrease" | "abstain";
  phase: "reduction" | "abstinence";
  lastRelapseAt: Date | null;
  allowsWeeklySkip: boolean;
  isCustom: boolean;
  icon: string | null;
  templateId: HabitTemplateId | null;
  categoryKey: HabitCategoryKey | null;
};

function growthStepForCustomUnit(unit: CustomHabitUnit): number {
  return unit === "minutes" ? CUSTOM_MINUTES_STEP : 1;
}

function customHabitMeta(unit: CustomHabitUnit): Pick<CalibratedHabit, "type" | "side" | "unit" | "progressionDirection" | "phase"> {
  return {
    type: "target",
    side: "light",
    unit,
    progressionDirection: "increase",
    phase: "reduction",
  };
}

function goalFromHabitIdentity(
  habit: HabitIdentity,
  profile: CalibrationProfile,
  baselineValue: number,
): number {
  return recommendLightGoal(habit, profile, baselineValue);
}

export function recalculateLightGoal(
  baselineValue: number,
  habit: HabitIdentity,
  profile: CalibrationProfile,
  _activeLightHabitsCount: number,
): number {
  return goalFromHabitIdentity(habit, profile, baselineValue);
}

export function calibrateHabit(input: CalibrateHabitInput): CalibratedHabit {
  const now = input.now ?? new Date();

  if (input.kind === "template") {
    const { template, templateId, baselineValue, profile } = input;

    if (templateId === "nail_biting") {
      return {
        name: template.name,
        type: template.type,
        side: template.side,
        unit: template.unit,
        baselineValue: 0,
        currentGoal: 0,
        growthStep: template.growthStep,
        progressionDirection: template.progressionDirection,
        phase: "abstinence",
        lastRelapseAt: now,
        allowsWeeklySkip: false,
        isCustom: false,
        icon: template.icon,
        templateId,
        categoryKey: null,
      };
    }

    if (template.side === "dark") {
      return {
        name: template.name,
        type: template.type,
        side: template.side,
        unit: template.unit,
        baselineValue,
        currentGoal: baselineValue,
        growthStep: template.growthStep,
        progressionDirection: template.progressionDirection,
        phase: template.phase,
        lastRelapseAt: null,
        allowsWeeklySkip: false,
        isCustom: false,
        icon: template.icon,
        templateId,
        categoryKey: null,
      };
    }

    const currentGoal = goalFromHabitIdentity(
      { name: template.name, unit: template.unit, templateId },
      profile,
      baselineValue,
    );

    return {
      name: template.name,
      type: template.type,
      side: template.side,
      unit: template.unit,
      baselineValue,
      currentGoal,
      growthStep: template.growthStep,
      progressionDirection: template.progressionDirection,
      phase: template.phase,
      lastRelapseAt: null,
      allowsWeeklySkip: true,
      isCustom: false,
      icon: template.icon,
      templateId,
      categoryKey: null,
    };
  }

  const { name, unit, baselineValue, categoryKey, profile, icon } = input;
  const currentGoal = goalFromHabitIdentity(
    { name, unit, templateId: null, categoryKey: categoryKey ?? null },
    profile,
    baselineValue,
  );
  const meta = customHabitMeta(unit);
  const isEarlyRise = categoryKey === "early_rise" || resolveLightActivityId({ name, unit }) === "energy-early";

  return {
    name,
    ...meta,
    baselineValue,
    currentGoal,
    growthStep: isEarlyRise ? EARLY_RISE_SHIFT_MIN : growthStepForCustomUnit(unit),
    lastRelapseAt: null,
    allowsWeeklySkip: true,
    isCustom: true,
    icon: icon ?? null,
    templateId: null,
    categoryKey: categoryKey ?? null,
  };
}
