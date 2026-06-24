import {
  BOOKS_PAGES_PER_MIN,
  BOOKS_SESSION_MIN,
  BOOKS_START_PAGES,
  FOREIGN_LANGUAGE_HABIT_NAME,
  LANGUAGE_SESSION_MAX,
  LANGUAGE_SESSION_MIN,
  LANGUAGE_SESSION_TARGET_MIN,
  MEDITATION_DAILY_GOAL_MIN,
  MEDITATION_HABIT_NAME,
  MEDITATION_SESSION_MIN,
  PUSHUP_SECONDS_PER_REP,
  type CustomHabitUnit,
  type HabitTemplateId,
  type HabitUnit,
} from "@mytodo/shared";
import type { CalibrationProfile } from "./calibration.js";

/**
 * Personalized workload recommendations.
 * Physical activity baselines align with WHO 2020 guidelines (150–300 min/week moderate
 * or 75–150 min/week vigorous for adults) and beginner programs such as NHS Couch to 5K.
 * Strength reps use conservative ACSM/ACE beginner tiers by age and sex.
 * Plank targets use beginner/intermediate hold standards by age (10–60 s per set).
 */

export type HabitIdentity = {
  name: string;
  unit: HabitUnit | CustomHabitUnit;
  templateId?: HabitTemplateId | null;
};

export type LightActivityId =
  | "mindfulness-meditation"
  | "mindfulness-books"
  | "mindfulness-language"
  | "mindfulness-gratitude"
  | "strength-workout"
  | "strength-running"
  | "strength-plank"
  | "strength-stretch"
  | "creator-programming"
  | "creator-creative"
  | "creator-custom"
  | "energy-walk"
  | "energy-early"
  | "energy-hobby"
  | "generic-light";

export type SessionPlanProfile = {
  tier: "micro" | "language" | "flexible" | "books";
  preferredMin: number;
  minMin: number;
  maxMin: number;
};

type AgeBand = "teen" | "young" | "adult" | "mature" | "senior";

const NAME_TO_ACTIVITY: Record<string, LightActivityId> = {
  [MEDITATION_HABIT_NAME]: "mindfulness-meditation",
  [FOREIGN_LANGUAGE_HABIT_NAME]: "mindfulness-language",
  "Дневник благодарности": "mindfulness-gratitude",
  "Силовая тренировка": "strength-workout",
  "Растяжка": "strength-stretch",
  "Программирование": "creator-programming",
  "Творческий проект": "creator-creative",
  "Ходьба на свежем воздухе": "energy-walk",
  "Ранний подъём": "energy-early",
  "Творчество / Хобби": "energy-hobby",
};

const TEMPLATE_TO_ACTIVITY: Partial<Record<HabitTemplateId, LightActivityId>> = {
  books: "mindfulness-books",
  running: "strength-running",
  plank: "strength-plank",
  pushups: "strength-workout",
};

/** ACSM-style conservative push-up test ceiling (sedentary / below-average). */
const BEGINNER_PUSHUP_POOR_MAX: Record<"male" | "female", Record<AgeBand, number>> = {
  male: { teen: 12, young: 16, adult: 11, mature: 9, senior: 4 },
  female: { teen: 6, young: 9, adult: 7, mature: 4, senior: 1 },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function computeBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0 || weightKg <= 0) {
    return 22;
  }

  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function getAgeBand(age: number): AgeBand {
  if (age < 18) return "teen";
  if (age < 30) return "young";
  if (age < 50) return "adult";
  if (age < 65) return "mature";
  return "senior";
}

function getGenderKey(gender: CalibrationProfile["gender"]): "male" | "female" {
  return gender === "female" ? "female" : "male";
}

/** Higher BMI and older age reduce high-impact cardio targets. */
function physicalLoadFactor(profile: CalibrationProfile): number {
  const bmi = computeBmi(profile.weightKg, profile.heightCm);
  const ageBand = getAgeBand(profile.age);

  let factor = 1;

  if (bmi < 18.5) factor *= 0.9;
  else if (bmi >= 30) factor *= 0.7;
  else if (bmi >= 25) factor *= 0.85;

  if (ageBand === "teen") factor *= 0.9;
  if (ageBand === "mature") factor *= 0.85;
  if (ageBand === "senior") factor *= 0.7;

  return factor;
}

function cognitiveLoadFactor(profile: CalibrationProfile): number {
  const ageBand = getAgeBand(profile.age);
  if (ageBand === "teen") return 0.85;
  if (ageBand === "senior") return 0.8;
  return 1;
}

export function resolveLightActivityId(habit: HabitIdentity): LightActivityId {
  const byName = NAME_TO_ACTIVITY[habit.name.trim()];
  if (byName) {
    return byName;
  }

  if (habit.templateId) {
    const byTemplate = TEMPLATE_TO_ACTIVITY[habit.templateId];
    if (byTemplate) {
      return byTemplate;
    }
  }

  if (habit.unit === "lessons") {
    return "mindfulness-language";
  }

  return "generic-light";
}

function beginnerPushupDailyTarget(profile: CalibrationProfile): number {
  const gender = getGenderKey(profile.gender);
  const band = getAgeBand(profile.age);
  const poorMax = BEGINNER_PUSHUP_POOR_MAX[gender][band];
  const scaled = Math.round(poorMax * 0.75);
  return clamp(roundTo(Math.max(scaled, 6), 2), 6, 30);
}

function plankDailySeconds(profile: CalibrationProfile): number {
  const band = getAgeBand(profile.age);
  const base =
    band === "teen" || band === "young"
      ? 45
      : band === "adult"
        ? 40
        : band === "mature"
          ? 30
          : 20;

  return clamp(Math.round(base * physicalLoadFactor(profile)), 15, 90);
}

function runningDailyMinutes(profile: CalibrationProfile): number {
  const band = getAgeBand(profile.age);
  const base = band === "senior" ? 12 : band === "teen" ? 15 : 20;
  return clamp(Math.round(base * physicalLoadFactor(profile)), 10, 30);
}

function walkingDailyMinutes(profile: CalibrationProfile): number {
  return clamp(Math.round(25 * physicalLoadFactor(profile)), 15, 35);
}

function stretchingDailyMinutes(profile: CalibrationProfile): number {
  return clamp(Math.round(12 * physicalLoadFactor(profile)), 8, 20);
}

function gratitudeDailyMinutes(profile: CalibrationProfile): number {
  return clamp(Math.round(7 * cognitiveLoadFactor(profile)), 5, 10);
}

function cognitiveDailyMinutes(profile: CalibrationProfile): number {
  return clamp(Math.round(30 * cognitiveLoadFactor(profile)), 20, 45);
}

function morningRoutineMinutes(profile: CalibrationProfile): number {
  return clamp(Math.round(15 * cognitiveLoadFactor(profile)), 10, 20);
}

/** Minutes reserved in the daily budget for one reading session. */
function booksSessionMinutes(): number {
  return BOOKS_SESSION_MIN;
}

/** Recommended daily target expressed in minutes of effort (for budget splitting). */
export function recommendDailyMinutes(
  activityId: LightActivityId,
  profile: CalibrationProfile,
): number {
  switch (activityId) {
    case "mindfulness-meditation":
      return MEDITATION_DAILY_GOAL_MIN;
    case "mindfulness-language":
      return LANGUAGE_SESSION_TARGET_MIN;
    case "mindfulness-books":
      return booksSessionMinutes();
    case "mindfulness-gratitude":
      return gratitudeDailyMinutes(profile);
    case "strength-workout":
      return (beginnerPushupDailyTarget(profile) * PUSHUP_SECONDS_PER_REP) / 60;
    case "strength-running":
      return runningDailyMinutes(profile);
    case "strength-plank":
      return plankDailySeconds(profile) / 60;
    case "strength-stretch":
      return stretchingDailyMinutes(profile);
    case "energy-walk":
      return walkingDailyMinutes(profile);
    case "energy-early":
      return morningRoutineMinutes(profile);
    case "creator-programming":
    case "creator-creative":
    case "creator-custom":
    case "energy-hobby":
      return cognitiveDailyMinutes(profile);
    case "generic-light":
      return cognitiveDailyMinutes(profile);
    default:
      return 20;
  }
}

export function minutesToGoal(unit: HabitUnit | CustomHabitUnit, minutes: number): number {
  switch (unit) {
    case "pages":
      return Math.max(1, Math.round(BOOKS_PAGES_PER_MIN * minutes));
    case "minutes":
      return Math.max(1, Math.round(minutes));
    case "reps":
      return Math.max(1, Math.round((minutes * 60) / PUSHUP_SECONDS_PER_REP));
    case "seconds":
      return Math.max(15, Math.round(minutes * 60));
    case "lessons":
      return Math.max(1, Math.round(minutes / LANGUAGE_SESSION_TARGET_MIN));
    default:
      return Math.max(1, Math.round(minutes));
  }
}

export function recommendLightGoal(
  habit: HabitIdentity,
  profile: CalibrationProfile,
  baselineValue: number,
): number {
  const activityId = resolveLightActivityId(habit);

  if (activityId === "mindfulness-meditation") {
    return Math.max(baselineValue, MEDITATION_DAILY_GOAL_MIN);
  }

  if (activityId === "mindfulness-books") {
    return Math.max(baselineValue, BOOKS_START_PAGES);
  }

  const minutes = recommendDailyMinutes(activityId, profile);
  const recommended = minutesToGoal(habit.unit, minutes);
  return Math.max(baselineValue, recommended);
}

export function resolveSessionPlanProfile(
  habit: HabitIdentity,
  neededMin: number,
): SessionPlanProfile {
  const activityId = resolveLightActivityId(habit);

  if (activityId === "mindfulness-meditation") {
    return {
      tier: "micro",
      preferredMin: MEDITATION_SESSION_MIN,
      minMin: MEDITATION_SESSION_MIN,
      maxMin: MEDITATION_SESSION_MIN,
    };
  }

  if (activityId === "mindfulness-books") {
    return {
      tier: "books",
      preferredMin: BOOKS_SESSION_MIN,
      minMin: BOOKS_SESSION_MIN,
      maxMin: BOOKS_SESSION_MIN,
    };
  }

  if (activityId === "mindfulness-language" || habit.unit === "lessons") {
    return {
      tier: "language",
      preferredMin: clamp(
        LANGUAGE_SESSION_TARGET_MIN,
        LANGUAGE_SESSION_MIN,
        Math.min(LANGUAGE_SESSION_MAX, neededMin),
      ),
      minMin: LANGUAGE_SESSION_MIN,
      maxMin: LANGUAGE_SESSION_MAX,
    };
  }

  return {
    tier: "flexible",
    preferredMin: neededMin,
    minMin: 1,
    maxMin: neededMin,
  };
}

/**
 * When several light habits share a budget, scale minute targets proportionally.
 */
export function distributeGoalsAcrossBudget(
  habits: Array<{ id: string; habit: HabitIdentity; baselineValue: number }>,
  profile: CalibrationProfile,
): Map<string, number> {
  const intrinsic = habits.map((entry) => ({
    id: entry.id,
    minutes: recommendDailyMinutes(resolveLightActivityId(entry.habit), profile),
    habit: entry.habit,
    baselineValue: entry.baselineValue,
  }));

  const totalIntrinsic = intrinsic.reduce((sum, row) => sum + row.minutes, 0);
  const scale =
    totalIntrinsic > 0 ? Math.min(1, profile.dailyBudgetMin / totalIntrinsic) : 1;

  const result = new Map<string, number>();
  for (const row of intrinsic) {
    const activityId = resolveLightActivityId(row.habit);

    if (activityId === "mindfulness-meditation") {
      result.set(row.id, Math.max(row.baselineValue, MEDITATION_DAILY_GOAL_MIN));
      continue;
    }

    if (activityId === "mindfulness-books") {
      result.set(row.id, Math.max(row.baselineValue, BOOKS_START_PAGES));
      continue;
    }

    const scaledMinutes = Math.max(1, row.minutes * scale);
    const goal = minutesToGoal(row.habit.unit, scaledMinutes);
    result.set(row.id, Math.max(row.baselineValue, goal));
  }

  return result;
}
