export type BookRecommendation = {
  id: string;
  title: string;
  author: string;
  description: string;
  /** Обложка — локальный путь или URL. */
  coverUrl: string;
  /** Прямая ссылка на скачивание (lib.ru, Gutenberg и т.п.). */
  ebookUrl: string;
  /** Подпись на кнопке скачивания. */
  ebookLabel?: string;
};

/** Бесплатные книги из общественного достояния для привычки «Читать книги». */
export const BOOK_RECOMMENDATIONS: BookRecommendation[] = [
  {
    id: "kak-zakalyalas-stal",
    title: "Как закалялась сталь",
    author: "Николай Островский",
    description:
      "Роман о силе воли и дисциплине. Герой не сдаётся перед трудностями — хороший ориентир для ежедневной привычки.",
    coverUrl: "/books/ostrovsky-cover.jpg",
    ebookUrl: "http://az.lib.ru/o/ostrowskij_n_a/ostrowskij_n_a-text_0010.fb2.zip",
    ebookLabel: "Скачать FB2",
  },
  {
    id: "meditations",
    title: "Размышления",
    author: "Марк Аврелий",
    description:
      "Записки римского императора-стоика о самоконтроле, долге и спокойствии перед трудностями.",
    coverUrl: "/books/meditations.jpg",
    ebookUrl: "https://zhurnal.lib.ru/a/ajnur_e_w/aureliusmeditations.fb2.zip",
    ebookLabel: "Скачать FB2",
  },
  {
    id: "self-help-smiles",
    title: "Саморазвитие",
    author: "Сэмюэл Смайлс",
    description:
      "Классика жанра self-help (1859): труд, характер и настойчивость как путь к личному росту.",
    coverUrl: "/books/samorazvitie-cover.jpg",
    ebookUrl:
      "https://publ.lib.ru/ARCHIVES/S/SMAYLS_Semyuel'/Smayls_S.__Samorazvitie_.(2000).[djv].zip",
    ebookLabel: "Скачать DJVU",
  },
  {
    id: "franklin-autobiography",
    title: "Автобиография",
    author: "Бенджамин Франклин",
    description:
      "История самодисциплины и привычек от отца-основателя США. Текст на английском, общественное достояние.",
    coverUrl: "/books/franklin-cover.jpg",
    ebookUrl: "https://www.gutenberg.org/ebooks/148.epub.noimages",
    ebookLabel: "Скачать EPUB",
  },
  {
    id: "chto-delat",
    title: "Что делать?",
    author: "Николай Чернышевский",
    description:
      "Роман о «новых людях»: честный труд, цели и внутренняя собранность — классика русской мотивационной прозы.",
    coverUrl: "/books/chto-delat.jpg",
    ebookUrl:
      "http://az.lib.ru/c/chernyshewskij_n_g/chernyshewskij_n_g-text_1862_01_chto_delat.fb2.zip",
    ebookLabel: "Скачать FB2",
  },
];
