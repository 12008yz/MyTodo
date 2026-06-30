export type DonutSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export const PIE_CHART_COLORS = {
  blue: "#7086FD",
  green: "#6FD195",
  orange: "#FFAE4C",
  cyan: "#07DBFA",
  purple: "#988AFC",
  sky: "#1F94FF",
  coral: "#FF928A",
} as const;

export function sumSegmentValues(segments: DonutSegment[]): number {
  return segments.reduce((total, segment) => total + segment.value, 0);
}
