import { listExerciseDemoUrls } from "@mytodo/shared";

const prefetchedUrls = new Set<string>();

export function getExerciseMediaUrls(): string[] {
  return [...listExerciseDemoUrls()];
}

/** Warm HTTP cache (and SW cache via fetch) when an exercise demo drawer opens. */
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

    void fetch(url).catch(() => {
      prefetchedUrls.delete(url);
    });
  }
}
