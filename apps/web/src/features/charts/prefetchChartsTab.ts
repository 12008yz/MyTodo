let prefetchStarted = false;

export function prefetchChartsTab(): void {
  if (prefetchStarted) {
    return;
  }
  prefetchStarted = true;

  void import("../../pages/ChartsPage/ChartsPage");
  void import("./HabitTrendChart");
}
