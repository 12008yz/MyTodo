import {
  BOOKS_PAGES_PER_MIN,
  CUSTOM_MINUTES_STEP,
  type CustomHabitUnit,
  type HabitTemplate,
  type HabitTemplateId,
  type HabitUnit,
  PUSHUP_SECONDS_PER_REP,
} from "@mytodo/shared";

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
};

function minutesPerLightHabit(dailyBudgetMin: number, activeLightHabitsIncludingNew: number): number {
  if (activeLightHabitsIncludingNew <= 0) {
    return dailyBudgetMin;
  }

  return dailyBudgetMin / activeLightHabitsIncludingNew;
}

function recommendedLightGoal(
  unit: HabitUnit,
  minutesShare: number,
): number {
  switch (unit) {
    case "pages":
      return Math.round(BOOKS_PAGES_PER_MIN * minutesShare);
    case "minutes":
      return Math.round(minutesShare);
    case "reps":
      return Math.round((minutesShare * 60) / PUSHUP_SECONDS_PER_REP);
    case "seconds":
      return Math.round(minutesShare * 60);
    case "lessons":
      return 1;
    default:
      return Math.round(minutesShare);
  }
}

export function recalculateLightGoal(
  baselineValue: number,
  unit: HabitUnit,
  profile: CalibrationProfile,
  activeLightHabitsCount: number,
): number {
  const minutesShare = minutesPerLightHabit(profile.dailyBudgetMin, activeLightHabitsCount);
  const recommended = recommendedLightGoal(unit, minutesShare);
  return Math.max(baselineValue, recommended);
}

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

export function calibrateHabit(input: CalibrateHabitInput): CalibratedHabit {
  const now = input.now ?? new Date();

  if (input.kind === "template") {
    const { template, templateId, baselineValue, profile, activeLightHabitsIncludingNew } = input;

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
      };
    }

    const currentGoal = recalculateLightGoal(
      baselineValue,
      template.unit,
      profile,
      activeLightHabitsIncludingNew,
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
    };
  }

  const { name, unit, baselineValue, profile, activeLightHabitsIncludingNew, icon } = input;
  const currentGoal = recalculateLightGoal(
    baselineValue,
    unit,
    profile,
    activeLightHabitsIncludingNew,
  );
  const meta = customHabitMeta(unit);

  return {
    name,
    ...meta,
    baselineValue,
    currentGoal,
    growthStep: growthStepForCustomUnit(unit),
    lastRelapseAt: null,
    allowsWeeklySkip: true,
    isCustom: true,
    icon: icon ?? null,
    templateId: null,
  };
}
