import type { HarshnessLevel } from "./coach-messages.js";
import type { HabitTemplateId } from "./habits.js";

export const COACH_DAILY_MESSAGE_LIMIT = 5;

export const BADGE_SWEET_FREEDOM = "sweet_freedom";

/** Dark habits eligible for AI coach chat (social_media excluded). */
export const COACH_ELIGIBLE_DARK_TEMPLATES = [
  "smoking",
  "sugar",
  "sweets",
  "nail_biting",
] as const satisfies readonly HabitTemplateId[];

export type CoachEligibleDarkTemplate = (typeof COACH_ELIGIBLE_DARK_TEMPLATES)[number];

export function isCoachEligibleDarkHabit(templateId: string | null | undefined): boolean {
  return (
    templateId != null &&
    (COACH_ELIGIBLE_DARK_TEMPLATES as readonly string[]).includes(templateId)
  );
}

export const COACH_QUICK_REPLIES = [
  "Тянет сорваться",
  "Не выдерживаю",
  "Мне легче",
] as const;

type DarkCoachUrgeMessages = Record<CoachEligibleDarkTemplate, Record<HarshnessLevel, string>>;

export const DARK_COACH_URGE_MESSAGES: DarkCoachUrgeMessages = {
  smoking: {
    1: "Срыв — это не конец. Ты уже на пути. Завтра новый день, и мы начнём отсчёт заново. Сейчас выпей воды и подожди 5 минут — тяга пройдёт.",
    2: "Хочется закурить — нормально. Но ты уже столько держишься. Выйди на воздух без сигареты, сделай 10 глубоких вдохов. Не сдавайся сейчас.",
    3: "Тяга — враг на 5 минут. Ты сильнее. Встань, отряхнись, вспомни зачем бросаешь. Сорвёшься — начнёшь сначала. Держи линию.",
  },
  sugar: {
    1: "Ты уже на шаг ближе к свободе. Представь, как чай станет вкуснее без сахара. Попробуй ягоды или тёплый чай вместо ложки сахара.",
    2: "Тянет на сладкое — организм привыкает. Подожди 10 минут, выпей воды. Ты контролируешь ложки, а не они тебя.",
    3: "Сахар зовёт — игнорируй. Каждый отказ — победа. Займись чем-то руками на 5 минут. Ты здесь не для слабости.",
  },
  sweets: {
    1: "Каждая конфета, от которой ты отказался, — шаг к лёгкости. Ты сильнее, чем думаешь. Попробуй фрукт или орехи вместо сладости.",
    2: "Сладкое — привычка, не голод. Подожди 5 минут. Если всё ещё хочется — съешь яблоко. Не ломай прогресс из-за импульса.",
    3: "Конфета не решит проблему. Дисциплина — решит. Отвлекись: 20 приседаний или холодная вода. Ты не слабак.",
  },
  nail_biting: {
    1: "Твои ногти — символ дисциплины. Каждый день без срыва ты становишься сильнее. Сожми кулаки, займись делом на 5 минут.",
    2: "Руки тянутся к ногтям — остановись. Намажь крем или займи руки антистрессом. Ты уже столько дней держишься.",
    3: "Грызть — слабость в моменте. Ты выбрал отказ. Переключись: холодная вода, 10 отжиманий. Держи линию, боец.",
  },
};

export function resolveDarkCoachUrgeMessage(
  templateId: string | null | undefined,
  harshnessLevel: HarshnessLevel,
): string {
  const level = harshnessLevel;
  if (templateId === "smoking") return DARK_COACH_URGE_MESSAGES.smoking[level];
  if (templateId === "sugar") return DARK_COACH_URGE_MESSAGES.sugar[level];
  if (templateId === "sweets") return DARK_COACH_URGE_MESSAGES.sweets[level];
  if (templateId === "nail_biting") return DARK_COACH_URGE_MESSAGES.nail_biting[level];
  const generic: Record<HarshnessLevel, string> = {
    1: "Тяга пройдёт. Подожди 5 минут, выпей воды. Ты справишься.",
    2: "Соберись. Импульс — не ты. Подожди и отвлекись.",
    3: "Держи линию. 5 минут — и станет легче. Не сдавайся.",
  };
  return generic[level];
}

export type CoachMessageIntent = "greeting" | "relief" | "thanks" | "help" | "urge" | "clarify";

const GREETING_RE =
  /^(привет|здравствуй(те)?|ало|алло?|хай|hello|салют|добрый\s+(день|вечер|утро)|доброе\s+утро)[\s!?.…,]*$/i;
const RELIEF_RE = /(легче|отпустило|полегчал|справил|держусь|получилось|прошло|отпускает)/i;
const THANKS_RE = /(спасибо|благодар)/i;
const HELP_RE = /(помог|что\s+делать|как\s+быть|не\s+знаю|подскаж)/i;
const URGE_RE =
  /(тянет|сорваться|не\s+выдерж|хочется|хочу|закурить|курить|сигарет|тяг|срыв|импульс|терплю|накрыло|слаб)/i;

const DARK_COACH_GREETING: Record<HarshnessLevel, string> = {
  1: "Привет! Я рядом, если накроет тяга. Напиши, что чувствуешь, или нажми кнопку ниже.",
  2: "Привет. Говори, что происходит — тянет сорваться или просто тяжело?",
  3: "Привет. Коротко: что случилось? Тяга, стресс или что-то ещё?",
};

const DARK_COACH_RELIEF =
  "Хорошо. Запомни это ощущение — ты справился. Если снова накроет, вернись сюда.";

const DARK_COACH_THANKS: Record<HarshnessLevel, string> = {
  1: "Не за что. Я рядом, если снова станет тяжело.",
  2: "Держись. Если накроет — пиши сразу.",
  3: "Ок. Не расслабляйся — тяга любит возвращаться.",
};

const DARK_COACH_CLARIFY: Record<HarshnessLevel, string> = {
  1: "Я на связи. Расскажи своими словами — тянет сорваться или уже полегчало?",
  2: "Слышу тебя. Скажи прямо: накрывает тяга или просто хочется поговорить?",
  3: "На связи. Тяга, стресс или другое? Одним предложением — разберём.",
};

export function detectCoachMessageIntent(message: string): CoachMessageIntent {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return "clarify";
  }
  if (RELIEF_RE.test(normalized)) {
    return "relief";
  }
  if (THANKS_RE.test(normalized)) {
    return "thanks";
  }
  if (GREETING_RE.test(normalized)) {
    return "greeting";
  }
  if (HELP_RE.test(normalized)) {
    return "help";
  }
  if (URGE_RE.test(normalized)) {
    return "urge";
  }
  return "clarify";
}

export function resolveDarkCoachReply(
  templateId: string | null | undefined,
  harshnessLevel: HarshnessLevel,
  message: string,
): string {
  const level = Math.min(3, Math.max(1, harshnessLevel)) as HarshnessLevel;
  const intent = detectCoachMessageIntent(message);

  switch (intent) {
    case "relief":
      return DARK_COACH_RELIEF;
    case "thanks":
      return DARK_COACH_THANKS[level];
    case "greeting":
      return DARK_COACH_GREETING[level];
    case "help":
    case "urge":
      return resolveDarkCoachUrgeMessage(templateId, level);
    case "clarify":
    default:
      return DARK_COACH_CLARIFY[level];
  }
}

export const BADGE_SWEET_FREEDOM_TITLE = "Сладкая свобода";
