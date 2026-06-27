import { STRENGTH_WORKOUT_EXERCISES } from "@mytodo/shared";

const prefetchedUrls = new Set<string>();

export function getExerciseMediaUrls(): string[] {
  return STRENGTH_WORKOUT_EXERCISES.map((exercise) => exercise.demoGifUrl);
}

/** Warm HTTP cache (and SW cache via fetch) when the strength workout drawer opens. */
export function prefetchExerciseMedia(): void {
  if (typeof document === "undefined") {
    return;
  }

  for (const url of getExerciseMediaUrls()) {
    if (prefetchedUrls.has(url)) {
      continue;
    }

    prefetchedUrls.add(url);

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = url;
    document.head.appendChild(link);

    void fetch(url, { cache: "force-cache" }).catch(() => {
      prefetchedUrls.delete(url);
    });
  }
}
