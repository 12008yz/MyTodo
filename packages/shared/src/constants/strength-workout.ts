export type StrengthWorkoutExercise = {
  id: string;
  name: string;
  description: string;
  /** Local demo media path (bundled in /public/exercises). */
  demoGifUrl: string;
};

/** Bump when replacing files under /public/exercises/ (also update sw.js cache name). */
export const EXERCISE_MEDIA_CACHE_VERSION = 1;

/** Bodyweight circuit — one rep per exercise per round (~5 min). */
export const STRENGTH_WORKOUT_EXERCISES: readonly StrengthWorkoutExercise[] = [
  {
    id: "squats",
    name: "Приседания (без веса)",
    description: "Король всех упражнений. Качает ноги и ягодицы.",
    demoGifUrl: "/exercises/squat.mp4",
  },
  {
    id: "pushups",
    name: "Отжимания",
    description: "Классика для груди, плеч и трицепсов.",
    demoGifUrl: "/exercises/pushups.mp4",
  },
  {
    id: "lunges",
    name: "Выпады",
    description: "Для баланса и силы ног.",
    demoGifUrl: "/exercises/lunges.mp4",
  },
  {
    id: "pullups",
    name: "Подтягивания",
    description: "Спина, бицепсы и хват — баланс к отжиманиям.",
    demoGifUrl: "/exercises/pullups.mp4",
  },
] as const;
