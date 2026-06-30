export const CHART_SERIES_COLORS = [
  "#7086FD",
  "#6FD195",
  "#FFAE4C",
  "#07DBFA",
  "#988AFC",
  "#1F94FF",
  "#FF928A",
  "#F472B6",
  "#34D399",
  "#FBBF24",
  "#A78BFA",
  "#60A5FA",
] as const;

export function chartSeriesColor(index: number): string {
  if (index < CHART_SERIES_COLORS.length) {
    return CHART_SERIES_COLORS[index]!;
  }
  const hue = (index * 41) % 360;
  return `hsl(${hue} 62% 58%)`;
}
