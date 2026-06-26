export const MAX_ACTIVE_HABITS = 25;

export const HABIT_SIDES = ["light", "dark"] as const;
export type HabitSide = (typeof HABIT_SIDES)[number];

export const HABIT_TYPES = ["target", "limit", "abstinence"] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

export const PROGRESSION_DIRECTIONS = ["increase", "decrease", "abstain"] as const;
export type ProgressionDirection = (typeof PROGRESSION_DIRECTIONS)[number];

export const HABIT_PHASES = ["reduction", "abstinence"] as const;
export type HabitPhase = (typeof HABIT_PHASES)[number];

export const HABIT_UNITS = [
  "pages",
  "minutes",
  "reps",
  "seconds",
  "cigarettes",
  "spoons",
  "pieces",
  "lessons",
] as const;
export type HabitUnit = (typeof HABIT_UNITS)[number];

export const HABIT_TEMPLATE_IDS = [
  "books",
  "pushups",
  "running",
  "plank",
  "smoking",
  "sugar",
  "sweets",
  "social_media",
  "nail_biting",
] as const;
export type HabitTemplateId = (typeof HABIT_TEMPLATE_IDS)[number];

export const CUSTOM_HABIT_UNITS = ["minutes", "pages", "reps", "lessons"] as const;
export type CustomHabitUnit = (typeof CUSTOM_HABIT_UNITS)[number];

export const HABIT_CATEGORY_KEYS = [
  "meditation",
  "language",
  "gratitude",
  "strength_workout",
  "stretching",
  "programming",
  "creative_project",
  "walking",
  "early_rise",
  "healthy_nutrition",
] as const;
export type HabitCategoryKey = (typeof HABIT_CATEGORY_KEYS)[number];

export const SOCIAL_MEDIA_MIN_GOAL = 15;
export const SOCIAL_MEDIA_STEP = 5;
/** Dark limit habits (smoking, sugar, sweets): reduce goal by 1 every N successful days. */
export const DARK_REDUCTION_INTERVAL_DAYS = 3;
/** Light target habits: increase goal by growthStep every N successful days at current goal. */
export const LIGHT_GROWTH_INTERVAL_DAYS = 3;
export const CUSTOM_MINUTES_STEP = 5;
/** Habit planning: ~2 min per page (0.5 pages/min). */
export const BOOKS_PAGES_PER_MIN = 0.5;
export const PUSHUP_SECONDS_PER_REP = 2;

export type HabitTemplate = {
  id: HabitTemplateId;
  name: string;
  side: HabitSide;
  type: HabitType;
  progressionDirection: ProgressionDirection;
  unit: HabitUnit;
  growthStep: number;
  /** Successful days at current goal before goal changes (dark decrease habits). */
  progressionIntervalDays: number;
  icon: string;
  phase: HabitPhase;
};

export const HABIT_TEMPLATES: Record<HabitTemplateId, HabitTemplate> = {
  books: {
    id: "books",
    name: "Чтение книг",
    side: "light",
    type: "target",
    progressionDirection: "increase",
    unit: "pages",
    growthStep: 1,
    progressionIntervalDays: LIGHT_GROWTH_INTERVAL_DAYS,
    icon: "/habits/light/books.png",
    phase: "reduction",
  },
  pushups: {
    id: "pushups",
    name: "Отжимания",
    side: "light",
    type: "target",
    progressionDirection: "increase",
    unit: "reps",
    growthStep: 1,
    progressionIntervalDays: LIGHT_GROWTH_INTERVAL_DAYS,
    icon: "💪",
    phase: "reduction",
  },
  running: {
    id: "running",
    name: "Бег",
    side: "light",
    type: "target",
    progressionDirection: "increase",
    unit: "minutes",
    growthStep: 1,
    progressionIntervalDays: LIGHT_GROWTH_INTERVAL_DAYS,
    icon: "🏃",
    phase: "reduction",
  },
  plank: {
    id: "plank",
    name: "Планка",
    side: "light",
    type: "target",
    progressionDirection: "increase",
    unit: "seconds",
    growthStep: 1,
    progressionIntervalDays: LIGHT_GROWTH_INTERVAL_DAYS,
    icon: "🧘",
    phase: "reduction",
  },
  smoking: {
    id: "smoking",
    name: "Курение",
    side: "dark",
    type: "limit",
    progressionDirection: "decrease",
    unit: "cigarettes",
    growthStep: 1,
    progressionIntervalDays: DARK_REDUCTION_INTERVAL_DAYS,
    icon: "/habits/dark/smoking.png",
    phase: "reduction",
  },
  sugar: {
    id: "sugar",
    name: "Сахар",
    side: "dark",
    type: "limit",
    progressionDirection: "decrease",
    unit: "spoons",
    growthStep: 1,
    progressionIntervalDays: DARK_REDUCTION_INTERVAL_DAYS,
    icon: "🥄",
    phase: "reduction",
  },
  sweets: {
    id: "sweets",
    name: "Сладости",
    side: "dark",
    type: "limit",
    progressionDirection: "decrease",
    unit: "pieces",
    growthStep: 1,
    progressionIntervalDays: DARK_REDUCTION_INTERVAL_DAYS,
    icon: "🍬",
    phase: "reduction",
  },
  social_media: {
    id: "social_media",
    name: "Соцсети",
    side: "dark",
    type: "limit",
    progressionDirection: "decrease",
    unit: "minutes",
    growthStep: SOCIAL_MEDIA_STEP,
    progressionIntervalDays: 1,
    icon: "/habits/dark/social-media.png",
    phase: "reduction",
  },
  nail_biting: {
    id: "nail_biting",
    name: "Грызть ногти",
    side: "dark",
    type: "abstinence",
    progressionDirection: "abstain",
    unit: "minutes",
    growthStep: 1,
    progressionIntervalDays: 1,
    icon: "💅",
    phase: "abstinence",
  },
};
