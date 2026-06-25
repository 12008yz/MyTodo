import {
  BOOKS_PAGES_PER_MIN,
  BOOKS_START_PAGES,
  CREATIVE_PROJECT_TARGET_MINUTES,
  EARLY_RISE_HABIT_NAME,
  EARLY_RISE_SHIFT_MIN,
  FOREIGN_LANGUAGE_HABIT_NAME,
  GRATITUDE_DAILY_MIN,
  HOBBY_TARGET_MINUTES,
  LESSON_MINUTES_ESTIMATE,
  LANGUAGE_SESSION_MAX,
  LANGUAGE_SESSION_MIN,
  LANGUAGE_SESSION_TARGET_MIN,
  MEDITATION_DAILY_GOAL_MIN,
  MEDITATION_HABIT_NAME,
  MEDITATION_SESSION_MIN,
  PLANK_START_SECONDS,
  PROGRAMMING_TARGET_MINUTES,
  PUSHUP_SECONDS_PER_REP,
  RUNNING_MIN_MINUTES,
  STRETCH_TARGET_MINUTES,
  STRENGTH_WORKOUT_TARGET_MINUTES,
  WALKING_MIN_MINUTES,
  type CustomHabitUnit,
  type HabitCategoryKey,
  type HabitTemplateId,
  type HabitUnit,
} from "@mytodo/shared";
import type { CalibrationProfile } from "./calibration.js";

export type HabitIdentity = {
  name: string;
  unit: HabitUnit | CustomHabitUnit;
  templateId?: HabitTemplateId | null;
  categoryKey?: HabitCategoryKey | null;
};

export type HabitComfortSetup = {
  habit: HabitIdentity;
  practicesNow?: boolean;
  baselineValue?: number;
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
  [EARLY_RISE_HABIT_NAME]: "energy-early",
  "Творчество / Хобби": "energy-hobby",
};

const TEMPLATE_TO_ACTIVITY: Partial<Record<HabitTemplateId, LightActivityId>> = {
  books: "mindfulness-books",
  running: "strength-running",
  plank: "strength-plank",
  pushups: "strength-workout",
};

const CATEGORY_TO_ACTIVITY: Record<HabitCategoryKey, LightActivityId> = {
  meditation: "mindfulness-meditation",
  language: "mindfulness-language",
  gratitude: "mindfulness-gratitude",
  strength_workout: "strength-workout",
  stretching: "strength-stretch",
  programming: "creator-programming",
  creative_project: "creator-creative",
  walking: "energy-walk",
  early_rise: "energy-early",
  hobby: "energy-hobby",
};

/** ACSM-style conservative push-up test ceiling (sedentary / below-average). */
const BEGINNER_PUSHUP_POOR_MAX: Record<"male" | "female", Record<AgeBand, number>> = {
  male: { teen: 12, young: 16, adult: 11, mature: 9, senior: 4 },
  female: { teen: 6, young: 9, adult: 7, mature: 4, senior: 1 },
};

export const DEFAULT_COMFORT_PROFILE: CalibrationProfile = {
  dailyBudgetMin: 60,
  age: 30,
  gender: "male",
  weightKg: 70,
  heightCm: 175,
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

export function booksSessionMinutesForPages(pages: number): number {
  return Math.max(1, Math.ceil(pages / BOOKS_PAGES_PER_MIN));
}

export function isEarlyRiseActivity(activityId: LightActivityId): boolean {
  return activityId === "energy-early";
}

export function resolveLightActivityId(habit: HabitIdentity): LightActivityId {
  if (habit.categoryKey) {
    return CATEGORY_TO_ACTIVITY[habit.categoryKey];
  }

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

function isPushupsOnlyHabit(habit: HabitIdentity): boolean {
  return habit.templateId === "pushups";
}

function isStrengthWorkoutCircuit(habit: HabitIdentity): boolean {
  return resolveLightActivityId(habit) === "strength-workout" && !isPushupsOnlyHabit(habit);
}

/** Recommended daily target expressed in minutes of effort (for budget estimates). */
export function recommendDailyMinutesForHabit(
  habit: HabitIdentity,
  profile: CalibrationProfile,
): number {
  const activityId = resolveLightActivityId(habit);

  if (activityId === "strength-workout") {
    if (isPushupsOnlyHabit(habit)) {
      return (beginnerPushupDailyTarget(profile) * PUSHUP_SECONDS_PER_REP) / 60;
    }
    return STRENGTH_WORKOUT_TARGET_MINUTES;
  }

  return recommendDailyMinutes(activityId, profile);
}

/** Recommended daily target expressed in minutes of effort (for budget estimates). */
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
      return booksSessionMinutesForPages(BOOKS_START_PAGES);
    case "mindfulness-gratitude":
      return GRATITUDE_DAILY_MIN;
    case "strength-workout":
      return STRENGTH_WORKOUT_TARGET_MINUTES;
    case "strength-running":
      return RUNNING_MIN_MINUTES;
    case "strength-plank":
      return PLANK_START_SECONDS / 60;
    case "strength-stretch":
      return STRETCH_TARGET_MINUTES;
    case "energy-walk":
      return WALKING_MIN_MINUTES;
    case "energy-early":
      return 0;
    case "creator-programming":
      return PROGRAMMING_TARGET_MINUTES;
    case "creator-creative":
      return CREATIVE_PROJECT_TARGET_MINUTES;
    case "creator-custom":
    case "energy-hobby":
    case "generic-light":
      return HOBBY_TARGET_MINUTES;
    default:
      return HOBBY_TARGET_MINUTES;
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
      return Math.max(PLANK_START_SECONDS, Math.round(minutes * 60));
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

  if (activityId === "mindfulness-language") {
    return Math.max(baselineValue, LANGUAGE_SESSION_TARGET_MIN);
  }

  if (isStrengthWorkoutCircuit(habit)) {
    return Math.max(baselineValue, STRENGTH_WORKOUT_TARGET_MINUTES);
  }

  if (activityId === "mindfulness-books") {
    return Math.max(baselineValue, BOOKS_START_PAGES);
  }

  if (activityId === "energy-early") {
    return Math.max(baselineValue, EARLY_RISE_SHIFT_MIN);
  }

  const minutes = recommendDailyMinutesForHabit(habit, profile);
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
    const booksMin = Math.max(1, Math.ceil(neededMin));
    return {
      tier: "books",
      preferredMin: booksMin,
      minMin: booksMin,
      maxMin: booksMin,
    };
  }

  if (activityId === "mindfulness-language" || habit.unit === "lessons") {
    return {
      tier: "language",
      preferredMin: LANGUAGE_SESSION_TARGET_MIN,
      minMin: LANGUAGE_SESSION_MIN,
      maxMin: LANGUAGE_SESSION_MAX,
    };
  }

  if (activityId === "strength-running") {
    const runningMin = Math.max(RUNNING_MIN_MINUTES, neededMin);
    return {
      tier: "flexible",
      preferredMin: runningMin,
      minMin: RUNNING_MIN_MINUTES,
      maxMin: runningMin,
    };
  }

  if (activityId === "strength-plank" || habit.unit === "seconds") {
    return {
      tier: "flexible",
      preferredMin: 1,
      minMin: 1,
      maxMin: 1,
    };
  }

  if (isStrengthWorkoutCircuit(habit)) {
    const workoutMin = Math.max(STRENGTH_WORKOUT_TARGET_MINUTES, Math.ceil(neededMin));
    return {
      tier: "flexible",
      preferredMin: workoutMin,
      minMin: STRENGTH_WORKOUT_TARGET_MINUTES,
      maxMin: workoutMin,
    };
  }

  if (habit.unit === "reps") {
    return {
      tier: "flexible",
      preferredMin: 1,
      minMin: 1,
      maxMin: Math.max(1, Math.ceil(neededMin)),
    };
  }

  return {
    tier: "flexible",
    preferredMin: neededMin,
    minMin: 1,
    maxMin: neededMin,
  };
}

export function estimateHabitComfortMinutes(
  habit: HabitIdentity,
  profile: CalibrationProfile = DEFAULT_COMFORT_PROFILE,
): number {
  const activityId = resolveLightActivityId(habit);
  if (isEarlyRiseActivity(activityId)) {
    return 0;
  }

  if (activityId === "mindfulness-books") {
    return booksSessionMinutesForPages(BOOKS_START_PAGES);
  }

  return recommendDailyMinutesForHabit(habit, profile);
}

export function habitGoalToComfortMinutes(
  unit: HabitUnit | CustomHabitUnit,
  goal: number,
): number {
  switch (unit) {
    case "pages":
      return booksSessionMinutesForPages(goal);
    case "minutes":
      return goal;
    case "reps":
      return (goal * PUSHUP_SECONDS_PER_REP) / 60;
    case "seconds":
      return goal / 60;
    case "lessons":
      return goal * LESSON_MINUTES_ESTIMATE;
    default:
      return goal;
  }
}

export function estimateHabitComfortMinutesWithSetup(
  input: HabitComfortSetup,
  profile: CalibrationProfile = DEFAULT_COMFORT_PROFILE,
): number {
  const { habit, practicesNow, baselineValue } = input;

  if (
    practicesNow === true &&
    baselineValue !== undefined &&
    Number.isFinite(baselineValue) &&
    baselineValue >= 0
  ) {
    return habitGoalToComfortMinutes(habit.unit, baselineValue);
  }

  return estimateHabitComfortMinutes(habit, profile);
}

/** Whole minutes shown to the user — always round up fractional totals. */
export function roundComfortMinutesTotal(minutes: number): number {
  return Math.ceil(minutes);
}

export function estimateHabitsComfortMinutes(
  habits: HabitIdentity[],
  profile: CalibrationProfile = DEFAULT_COMFORT_PROFILE,
): number {
  const total = habits.reduce(
    (sum, habit) => sum + estimateHabitComfortMinutes(habit, profile),
    0,
  );
  return roundComfortMinutesTotal(total);
}

export function estimateHabitsComfortMinutesWithSetup(
  habits: HabitComfortSetup[],
  profile: CalibrationProfile = DEFAULT_COMFORT_PROFILE,
): number {
  const total = habits.reduce(
    (sum, habit) => sum + estimateHabitComfortMinutesWithSetup(habit, profile),
    0,
  );
  return roundComfortMinutesTotal(total);
}

export function formatHabitComfortLabel(habit: HabitIdentity): string {
  const activityId = resolveLightActivityId(habit);

  switch (activityId) {
    case "mindfulness-meditation":
      return "~1 мин/день";
    case "mindfulness-language":
      return "~25 мин/день";
    case "mindfulness-books":
      return `5 стр. (~${booksSessionMinutesForPages(BOOKS_START_PAGES)} мин)`;
    case "mindfulness-gratitude":
      return "~2 мин/день";
    case "strength-running":
      return "от 10 мин/день";
    case "strength-plank":
      return "от 20 сек/день";
    case "strength-stretch":
      return "1–2 мин/день";
    case "energy-walk":
      return "от 10 мин/день";
    case "energy-early":
      return "раньше на 5 мин";
    case "creator-programming":
    case "creator-creative":
    case "creator-custom":
    case "energy-hobby":
    case "generic-light":
      return "~20 мин/день";
    case "strength-workout":
      return "по силам";
    default:
      return "~20 мин/день";
  }
}

export function formatHabitComfortLabelWithSetup(
  input: HabitComfortSetup,
  _profile: CalibrationProfile = DEFAULT_COMFORT_PROFILE,
): string {
  const { habit, practicesNow, baselineValue } = input;

  if (
    practicesNow === true &&
    baselineValue !== undefined &&
    Number.isFinite(baselineValue) &&
    baselineValue >= 0
  ) {
    const minutes = habitGoalToComfortMinutes(habit.unit, baselineValue);

    if (habit.unit === "pages") {
      return `${baselineValue} стр. (~${Math.ceil(minutes)} мин)`;
    }
    if (habit.unit === "minutes" || habit.unit === "lessons") {
      return `~${Math.ceil(minutes)} мин/день`;
    }
    if (habit.unit === "reps") {
      return `${baselineValue} раз (~${Math.ceil(minutes)} мин)`;
    }
    if (habit.unit === "seconds") {
      return `${baselineValue} сек (~${Math.ceil(minutes)} мин)`;
    }
  }

  return formatHabitComfortLabel(habit);
}

export function formatEarlyRiseTargetWakeTime(wakeTime: string, shiftMinutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(wakeTime.trim());
  if (!match) {
    return wakeTime;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * 60 + minutes - shiftMinutes;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHours = Math.floor(normalized / 60);
  const nextMinutes = normalized % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

/**
 * Sets personalized goals per habit. Fixed comfort targets are not scaled down
 * when the user picks more habits than their budget — onboarding warns instead.
 */
export function distributeGoalsAcrossBudget(
  habits: Array<{ id: string; habit: HabitIdentity; baselineValue: number }>,
  profile: CalibrationProfile,
): Map<string, number> {
  const result = new Map<string, number>();

  for (const row of habits) {
    result.set(
      row.id,
      recommendLightGoal(row.habit, profile, row.baselineValue),
    );
  }

  return result;
}
