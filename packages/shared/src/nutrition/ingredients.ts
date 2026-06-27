import type { NutritionIngredient } from "./types.js";

export const NUTRITION_INGREDIENTS: NutritionIngredient[] = [
  { id: "tomato", label: "Помидор", category: "vegetables", aliases: ["помидоры"] },
  { id: "cucumber", label: "Огурец", category: "vegetables", aliases: ["огурцы"] },
  { id: "broccoli", label: "Брокколи", category: "vegetables" },
  { id: "carrot", label: "Морковь", category: "vegetables", aliases: ["морковка"] },
  { id: "zucchini", label: "Кабачок", category: "vegetables", aliases: ["кабачки", "цуккини"] },
  { id: "bell_pepper", label: "Болгарский перец", category: "vegetables", aliases: ["перец"] },
  { id: "spinach", label: "Шпинат", category: "vegetables" },
  { id: "cabbage", label: "Капуста", category: "vegetables" },
  { id: "onion", label: "Лук", category: "vegetables", aliases: ["лук репчатый"] },
  { id: "garlic", label: "Чеснок", category: "vegetables" },
  { id: "potato", label: "Картофель", category: "vegetables", aliases: ["картошка"] },
  { id: "eggplant", label: "Баклажан", category: "vegetables", aliases: ["баклажаны"] },
  { id: "beet", label: "Свёкла", category: "vegetables", aliases: ["свекла"] },
  { id: "lettuce", label: "Салат листовой", category: "vegetables", aliases: ["салат"] },
  { id: "green_beans", label: "Стручковая фасоль", category: "vegetables" },
  { id: "peas", label: "Горошек", category: "vegetables" },
  { id: "corn", label: "Кукуруза", category: "vegetables" },
  { id: "pumpkin", label: "Тыква", category: "vegetables" },
  { id: "celery", label: "Сельдерей", category: "vegetables" },
  { id: "radish", label: "Редис", category: "vegetables" },
  { id: "apple", label: "Яблоко", category: "vegetables", aliases: ["яблоки"] },

  { id: "chicken_breast", label: "Куриная грудка", category: "protein", aliases: ["грудка", "курица"] },
  { id: "turkey", label: "Индейка", category: "protein" },
  { id: "egg", label: "Яйцо", category: "protein", aliases: ["яйца"] },
  { id: "tuna_canned", label: "Тунец консервированный", category: "protein", aliases: ["тунец"] },
  { id: "cottage_cheese", label: "Творог", category: "protein" },
  { id: "salmon", label: "Лосось", category: "protein", aliases: ["семга", "сёмга"] },
  { id: "beef_lean", label: "Говядина постная", category: "protein", aliases: ["говядина"] },
  { id: "chickpeas", label: "Нут", category: "protein" },
  { id: "lentils", label: "Чечевица", category: "protein" },
  { id: "beans", label: "Фасоль", category: "protein" },
  { id: "tofu", label: "Тофу", category: "protein" },
  { id: "shrimp", label: "Креветки", category: "protein" },

  { id: "milk", label: "Молоко", category: "dairy" },
  { id: "kefir", label: "Кефир", category: "dairy" },
  { id: "yogurt", label: "Йогурт натуральный", category: "dairy", aliases: ["йогурт"] },
  { id: "cheese", label: "Сыр", category: "dairy" },
  { id: "feta", label: "Брынза / фета", category: "dairy", aliases: ["брынза", "фета"] },

  { id: "buckwheat", label: "Гречка", category: "grains" },
  { id: "oatmeal", label: "Овсянка", category: "grains", aliases: ["овсяные хлопья"] },
  { id: "rice", label: "Рис", category: "grains" },
  { id: "pasta", label: "Макароны", category: "grains", aliases: ["паста"] },
  { id: "quinoa", label: "Киноа", category: "grains" },
  { id: "bulgur", label: "Булгур", category: "grains" },
  { id: "bread_whole", label: "Хлеб цельнозерновой", category: "grains", aliases: ["хлеб"] },

  { id: "olive_oil", label: "Оливковое масло", category: "pantry", aliases: ["масло"] },
  { id: "lemon", label: "Лимон", category: "pantry", aliases: ["лимонный сок"] },
  { id: "herbs", label: "Зелень", category: "pantry", aliases: ["укроп", "петрушка", "кинза"] },
  { id: "mustard", label: "Горчица", category: "pantry" },
  { id: "honey", label: "Мёд", category: "pantry", aliases: ["мед"] },
  { id: "nuts", label: "Орехи", category: "pantry", aliases: ["грецкие орехи"] },
  { id: "tomato_paste", label: "Томатная паста", category: "pantry" },
  { id: "soy_sauce", label: "Соевый соус", category: "pantry" },
  { id: "ginger", label: "Имбирь", category: "pantry" },
];

const INGREDIENT_BY_ID = new Map(NUTRITION_INGREDIENTS.map((item) => [item.id, item]));

export function getNutritionIngredient(id: string): NutritionIngredient | undefined {
  return INGREDIENT_BY_ID.get(id);
}

export function isKnownNutritionIngredientId(id: string): boolean {
  return INGREDIENT_BY_ID.has(id);
}

export function findNutritionIngredientsByQuery(query: string): NutritionIngredient[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return NUTRITION_INGREDIENTS;
  }

  return NUTRITION_INGREDIENTS.filter((item) => {
    if (item.label.toLowerCase().includes(normalized)) {
      return true;
    }
    return item.aliases?.some((alias) => alias.toLowerCase().includes(normalized)) ?? false;
  });
}

export type ParseNutritionProductsResult = {
  ingredientIds: string[];
  unrecognized: string[];
};

function normalizeProductToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function splitProductTokens(text: string): string[] {
  return text
    .split(/[,;\n]+|(?:\s+и\s+)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function namesForIngredient(item: NutritionIngredient): string[] {
  return [item.label, ...(item.aliases ?? [])].map((name) => normalizeProductToken(name));
}

function matchProductToken(token: string): string | null {
  const normalized = normalizeProductToken(token);
  if (!normalized) {
    return null;
  }

  for (const item of NUTRITION_INGREDIENTS) {
    for (const name of namesForIngredient(item)) {
      if (normalized === name) {
        return item.id;
      }
    }
  }

  let best: { id: string; score: number } | null = null;

  for (const item of NUTRITION_INGREDIENTS) {
    for (const name of namesForIngredient(item)) {
      if (normalized.length < 2 && name.length > normalized.length) {
        continue;
      }
      if (normalized.includes(name) || name.includes(normalized)) {
        const score = name.length;
        if (!best || score > best.score) {
          best = { id: item.id, score };
        }
      }
    }
  }

  return best?.id ?? null;
}

export function parseNutritionProductsText(text: string): ParseNutritionProductsResult {
  const ingredientIds: string[] = [];
  const unrecognized: string[] = [];
  const seen = new Set<string>();

  for (const token of splitProductTokens(text)) {
    const matchedId = matchProductToken(token);
    if (matchedId) {
      if (!seen.has(matchedId)) {
        seen.add(matchedId);
        ingredientIds.push(matchedId);
      }
      continue;
    }
    unrecognized.push(token);
  }

  return { ingredientIds, unrecognized };
}

export function formatNutritionIngredientIds(ids: string[]): string {
  return ids
    .map((id) => getNutritionIngredient(id)?.label ?? id)
    .join(", ");
}
