export const MAX_ACTIVE_HABITS = 6;

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

export const SOCIAL_MEDIA_MIN_GOAL = 15;
export const SOCIAL_MEDIA_STEP = 5;
export const CUSTOM_MINUTES_STEP = 5;
export const BOOKS_PAGES_PER_MIN = 2;
export const PUSHUP_SECONDS_PER_REP = 2;

export type HabitTemplate = {
  id: HabitTemplateId;
  name: string;
  side: HabitSide;
  type: HabitType;
  progressionDirection: ProgressionDirection;
  unit: HabitUnit;
  growthStep: number;
  icon: string;
  phase: HabitPhase;
};

export const HABIT_TEMPLATES: Record<HabitTemplateId, HabitTemplate> = {
  books: {
    id: "books",
    name: "Читать книги",
    side: "light",
    type: "target",
    progressionDirection: "increase",
    unit: "pages",
    growthStep: 1,
    icon: "📚",
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
    icon: "🚬",
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
    icon: "📱",
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
    icon: "💅",
    phase: "abstinence",
  },
};
