export type BookRecommendation = {
  id: string;
  title: string;
  author: string;
  description: string;
  /** Ссылка на электронную книгу — добавь, когда будет готова. */
  ebookUrl?: string;
};

/** Рекомендации для привычки «Читать книги». Обновляй список и ebookUrl по мере готовности. */
export const BOOK_RECOMMENDATIONS: BookRecommendation[] = [
  {
    id: "atomic-habits",
    title: "Атомные привычки",
    author: "Джеймс Клир",
    description: "Про маленькие шаги, которые накапливаются в большие изменения.",
  },
  {
    id: "deep-work",
    title: "Глубокая работа",
    author: "Кэл Ньюпорт",
    description: "Как концентрироваться в мире отвлечений и делать важное.",
  },
  {
    id: "psychology-of-money",
    title: "Психология денег",
    author: "Морган Хаузел",
    description: "Короткие истории о том, как люди думают о деньгах и решениях.",
  },
];
