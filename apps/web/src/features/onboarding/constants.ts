import { HABIT_TEMPLATES, type HabitTemplateId } from "@mytodo/shared";
import type { OnboardingStepId } from "./types";

export const ONBOARDING_STEPS: OnboardingStepId[] = [
  "welcome",
  "light",
  "dark",
  "body",
  "harshness",
  "finale",
];

export const DARK_TEMPLATE_IDS = [
  "smoking",
  "sugar",
  "sweets",
  "social_media",
  "nail_biting",
] as const satisfies readonly HabitTemplateId[];

export const HARSHNESS_OPTIONS = [
  {
    level: 1 as const,
    emoji: "🌿",
    title: "Мягкий наставник",
    quote: "Ты сможешь, я верю в тебя.",
  },
  {
    level: 2 as const,
    emoji: "📐",
    title: "Строгий тренер",
    quote: "Соберись, тряпка. Ты лучше этого.",
  },
  {
    level: 3 as const,
    emoji: "🗡️",
    title: "Армейский сержант",
    quote: "Ты еблан, если сейчас сорвёшься. Делай!",
  },
];

export const SUBSCRIPTION_PLANS = [
  { id: "1m", label: "1 месяц", price: "1 990 ₽" },
  { id: "2m", label: "2 месяца", price: "3 790 ₽" },
  { id: "3m", label: "3 месяца", price: "5 490 ₽" },
] as const;

export function getBaselineLabel(templateId: HabitTemplateId): string {
  const template = HABIT_TEMPLATES[templateId];
  switch (template.unit) {
    case "pages":
      return "Сколько страниц в день сейчас?";
    case "reps":
      return "Сколько раз в день сейчас?";
    case "minutes":
      return "Сколько минут в день сейчас?";
    case "seconds":
      return "Сколько секунд в день сейчас?";
    case "cigarettes":
      return "Сколько сигарет в день сейчас?";
    case "spoons":
      return "Сколько ложек сахара в день?";
    case "pieces":
      return "Сколько конфет/сладостей в день?";
    default:
      return "Сколько в день прямо сейчас?";
  }
}

export function getDarkSpeech(habitName: string, baseline: number, unit: string): string {
  if (unit === "отказ") {
    return `Хорошо. Ты выбрал «${habitName}». Мы включим режим отказа и будем держать дисциплину каждый день. Тёмная сторона берёт тебя под контроль.`;
  }

  return `«${habitName}»: ${baseline} ${unit} в день. Снижаем по 1 в день — через ${baseline} ${baseline === 1 ? "день" : baseline < 5 ? "дня" : "дней"} будешь свободен. Тёмная сторона берёт тебя под контроль.`;
}

export function unitLabel(unit: string): string {
  const labels: Record<string, string> = {
    pages: "стр.",
    reps: "раз",
    minutes: "мин",
    seconds: "сек",
    cigarettes: "сиг.",
    spoons: "лож.",
    pieces: "шт.",
    lessons: "ур.",
  };
  return labels[unit] ?? unit;
}
