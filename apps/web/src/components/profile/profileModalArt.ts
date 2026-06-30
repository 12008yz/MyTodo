export type ProfileModalArtVariant =
  | "yin-yang"
  | "spark"
  | "horizon"
  | "pulse"
  | "forge"
  | "signal"
  | "chapter"
  | "orbit"
  | "lifeline";

type WavePaths = {
  light: string;
  dark: string;
};

type WaveAccent = {
  cx: number;
  cy: number;
  r: number;
  fill: string;
};

export type WaveArtConfig = {
  paths: WavePaths;
  glowLight: { cx: number; cy: number; rx: number; ry: number };
  glowDark: { cx: number; cy: number; rx: number; ry: number };
  accents: [WaveAccent, WaveAccent];
};

export const PROFILE_MODAL_ART: Record<ProfileModalArtVariant, WaveArtConfig> = {
  "yin-yang": {
    paths: {
      light: "M0 0 H360 V42 C315 62, 270 18, 225 42 S135 62, 90 42 S45 18, 0 42 Z",
      dark: "M0 42 C45 18, 90 62, 135 42 S225 18, 270 42 S315 62, 360 42 L360 80 L0 80 Z",
    },
    glowLight: { cx: 72, cy: 30, rx: 52, ry: 28 },
    glowDark: { cx: 288, cy: 54, rx: 48, ry: 26 },
    accents: [
      { cx: 108, cy: 34, r: 5.5, fill: "rgba(95, 51, 225, 0.22)" },
      { cx: 252, cy: 48, r: 5.5, fill: "rgba(255, 125, 83, 0.32)" },
    ],
  },
  spark: {
    paths: {
      light: "M0 0 H360 V40 C290 58, 230 24, 170 40 S110 56, 50 36 S20 20, 0 40 Z",
      dark: "M0 40 C20 20, 50 36, 110 56 S170 40, 230 24, 290 58, 360 40 L360 80 L0 80 Z",
    },
    glowLight: { cx: 88, cy: 28, rx: 46, ry: 24 },
    glowDark: { cx: 276, cy: 52, rx: 44, ry: 22 },
    accents: [
      { cx: 124, cy: 32, r: 4.5, fill: "rgba(236, 72, 153, 0.35)" },
      { cx: 238, cy: 46, r: 6, fill: "rgba(167, 139, 250, 0.38)" },
    ],
  },
  horizon: {
    paths: {
      light: "M0 0 H360 V44 C320 28, 280 60, 240 44 S160 28, 120 44 S60 58, 0 44 Z",
      dark: "M0 44 C60 58, 120 44, 160 28 S240 44, 280 60, 320 28, 360 44 L360 80 L0 80 Z",
    },
    glowLight: { cx: 64, cy: 26, rx: 58, ry: 30 },
    glowDark: { cx: 300, cy: 56, rx: 50, ry: 24 },
    accents: [
      { cx: 92, cy: 30, r: 7, fill: "rgba(251, 191, 36, 0.45)" },
      { cx: 268, cy: 50, r: 4, fill: "rgba(129, 140, 248, 0.5)" },
    ],
  },
  pulse: {
    paths: {
      light: "M0 0 H360 V36 C300 56, 250 20, 200 36 S150 52, 100 30 S50 14, 0 36 Z",
      dark: "M0 36 C50 14, 100 30, 150 52 S200 36, 250 20, 300 56, 360 36 L360 80 L0 80 Z",
    },
    glowLight: { cx: 78, cy: 24, rx: 40, ry: 20 },
    glowDark: { cx: 282, cy: 54, rx: 54, ry: 28 },
    accents: [
      { cx: 118, cy: 28, r: 5, fill: "rgba(239, 68, 68, 0.4)" },
      { cx: 248, cy: 48, r: 5.5, fill: "rgba(95, 51, 225, 0.28)" },
    ],
  },
  forge: {
    paths: {
      light:
        "M0 0 H360 V44 C308 58, 258 30, 208 44 S108 58, 58 34 S12 52, 0 44 Z",
      dark:
        "M0 44 C12 52, 58 34, 108 58 S208 44, 258 30, 308 58, 360 44 L360 80 L0 80 Z",
    },
    glowLight: { cx: 90, cy: 24, rx: 56, ry: 26 },
    glowDark: { cx: 270, cy: 58, rx: 52, ry: 24 },
    accents: [
      { cx: 132, cy: 28, r: 4.5, fill: "rgba(163, 163, 163, 0.45)" },
      { cx: 236, cy: 52, r: 6.5, fill: "rgba(234, 88, 12, 0.42)" },
    ],
  },
  signal: {
    paths: {
      light: "M0 0 H360 V42 C310 58, 260 26, 210 42 S160 58, 110 42 S60 26, 0 42 Z",
      dark: "M0 42 C60 26, 110 42, 160 58 S210 42, 260 26, 310 58, 360 42 L360 80 L0 80 Z",
    },
    glowLight: { cx: 70, cy: 28, rx: 50, ry: 26 },
    glowDark: { cx: 290, cy: 52, rx: 46, ry: 24 },
    accents: [
      { cx: 100, cy: 34, r: 4, fill: "rgba(34, 211, 238, 0.45)" },
      { cx: 260, cy: 46, r: 5, fill: "rgba(124, 82, 255, 0.38)" },
    ],
  },
  chapter: {
    paths: {
      light: "M0 0 H360 V43 C300 62, 250 22, 200 43 S150 62, 100 43 S50 22, 0 43 Z",
      dark: "M0 43 C50 22, 100 43, 150 62 S200 43, 250 22, 300 62, 360 43 L360 80 L0 80 Z",
    },
    glowLight: { cx: 82, cy: 30, rx: 54, ry: 28 },
    glowDark: { cx: 278, cy: 54, rx: 42, ry: 22 },
    accents: [
      { cx: 116, cy: 32, r: 5, fill: "rgba(217, 119, 6, 0.35)" },
      { cx: 244, cy: 48, r: 4.5, fill: "rgba(59, 130, 246, 0.32)" },
    ],
  },
  orbit: {
    paths: {
      light: "M0 0 H360 V41 C305 55, 255 27, 205 41 S155 55, 105 41 S55 27, 0 41 Z",
      dark: "M0 41 C55 27, 105 41, 155 55 S205 41, 255 27, 305 55, 360 41 L360 80 L0 80 Z",
    },
    glowLight: { cx: 68, cy: 27, rx: 46, ry: 24 },
    glowDark: { cx: 292, cy: 53, rx: 52, ry: 26 },
    accents: [
      { cx: 132, cy: 33, r: 3.5, fill: "rgba(96, 165, 250, 0.55)" },
      { cx: 228, cy: 47, r: 3.5, fill: "rgba(167, 139, 250, 0.5)" },
    ],
  },
  lifeline: {
    paths: {
      light: "M0 0 H360 V42 C315 58, 270 26, 225 42 S180 58, 135 42 S90 26, 0 42 Z",
      dark: "M0 42 C90 26, 135 42, 180 58 S225 42, 270 26, 315 58, 360 42 L360 80 L0 80 Z",
    },
    glowLight: { cx: 74, cy: 29, rx: 50, ry: 26 },
    glowDark: { cx: 286, cy: 51, rx: 44, ry: 22 },
    accents: [
      { cx: 104, cy: 35, r: 5, fill: "rgba(34, 197, 94, 0.42)" },
      { cx: 256, cy: 45, r: 4.5, fill: "rgba(45, 212, 191, 0.38)" },
    ],
  },
};
