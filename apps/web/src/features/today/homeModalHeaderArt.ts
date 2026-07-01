import type { HabitCategoryKey, HabitTemplateId } from "@mytodo/shared";

export type HomeModalGlyphSegment = {
  text: string;
  kind: "plus" | "value" | "unit" | "symbol" | "operator";
};

export type HomeModalGlyphLayout =
  | "orbit-a"
  | "orbit-b"
  | "orbit-c"
  | "orbit-d"
  | "orbit-e"
  | "orbit-f"
  | "orbit-g"
  | "orbit-h";

export type HomeModalGlyph = {
  id: string;
  segments: HomeModalGlyphSegment[];
  layout: HomeModalGlyphLayout;
};

export type HomeModalHeaderArtKey =
  | "books"
  | "running"
  | "plank"
  | "meditation"
  | "gratitude"
  | "stretching"
  | "programming"
  | "creative_project"
  | "walking"
  | "variant-0"
  | "variant-1"
  | "variant-2";

export type HomeModalHeaderArt = {
  theme: string;
  heroPlacement: "center" | "left" | "right" | "corner";
  glyphs: HomeModalGlyph[];
};

const L = {
  a: "orbit-a",
  b: "orbit-b",
  c: "orbit-c",
  d: "orbit-d",
  e: "orbit-e",
  f: "orbit-f",
  g: "orbit-g",
  h: "orbit-h",
} as const satisfies Record<string, HomeModalGlyphLayout>;

function glyph(
  id: string,
  layout: HomeModalGlyphLayout,
  segments: HomeModalGlyphSegment[],
): HomeModalGlyph {
  return { id, layout, segments };
}

function sym(layout: HomeModalGlyphLayout, text: string, id?: string): HomeModalGlyph {
  return glyph(id ?? `sym-${text}-${layout}`, layout, [{ text, kind: "symbol" }]);
}

function expr(
  id: string,
  layout: HomeModalGlyphLayout,
  parts: Array<string | HomeModalGlyphSegment>,
): HomeModalGlyph {
  const segments = parts.map((part) =>
    typeof part === "string"
      ? ({ text: part, kind: "symbol" as const })
      : part,
  );
  return glyph(id, layout, segments);
}

export const HOME_MODAL_HEADER_ART: Record<HomeModalHeaderArtKey, HomeModalHeaderArt> = {
  meditation: {
    theme: "meditation",
    heroPlacement: "center",
    glyphs: [
      sym(L.b, "○", "med-o"),
      sym(L.d, "~", "med-wave"),
      sym(L.f, "·", "med-dot"),
      sym(L.h, "°", "med-deg"),
      expr("med-breath", L.c, ["4", { text: "+", kind: "plus" }, "7"]),
      sym(L.a, "@", "med-at"),
      sym(L.g, "*", "med-star"),
      expr("med-rest", L.e, ["_", { text: "%", kind: "symbol" }]),
    ],
  },
  books: {
    theme: "books",
    heroPlacement: "right",
    glyphs: [
      sym(L.c, "@", "book-at"),
      sym(L.a, "§", "book-section"),
      sym(L.e, "#", "book-hash"),
      expr("book-pages", L.b, ["2", { text: "+", kind: "plus" }, "3"]),
      sym(L.g, "«", "book-quote-l"),
      sym(L.d, "»", "book-quote-r"),
      sym(L.f, "·", "book-dot"),
      expr("book-mark", L.h, ["_", { text: "%", kind: "symbol" }]),
    ],
  },
  running: {
    theme: "running",
    heroPlacement: "left",
    glyphs: [
      sym(L.c, "→", "run-arrow"),
      expr("run-km", L.e, ["5", { text: "+", kind: "plus" }, "2"]),
      sym(L.a, "/", "run-slash"),
      sym(L.b, "~", "run-wave"),
      sym(L.d, "*", "run-star"),
      sym(L.g, "·", "run-dot"),
      expr("run-pace", L.f, ["@", "3"]),
      sym(L.h, "%", "run-pct"),
    ],
  },
  plank: {
    theme: "plank",
    heroPlacement: "corner",
    glyphs: [
      expr("plank-sec", L.c, ["30", { text: "+", kind: "plus" }, "5"]),
      sym(L.a, "|", "plank-bar"),
      sym(L.e, "—", "plank-line"),
      sym(L.b, "°", "plank-deg"),
      sym(L.d, "·", "plank-dot"),
      sym(L.g, "*", "plank-star"),
      expr("plank-hold", L.f, ["_", "/"]),
      sym(L.h, "@", "plank-at"),
    ],
  },
  gratitude: {
    theme: "gratitude",
    heroPlacement: "center",
    glyphs: [
      sym(L.c, "✦", "grat-star"),
      expr("grat-plus", L.a, ["2", { text: "+", kind: "plus" }, "3"]),
      sym(L.e, "@", "grat-at"),
      sym(L.b, "·", "grat-dot"),
      sym(L.d, "~", "grat-wave"),
      sym(L.g, "*", "grat-asterisk"),
      sym(L.f, "%", "grat-pct"),
      expr("grat-mark", L.h, ["_", "?"]),
    ],
  },
  stretching: {
    theme: "stretching",
    heroPlacement: "right",
    glyphs: [
      sym(L.c, "~", "stretch-wave"),
      sym(L.a, "/", "stretch-slash"),
      sym(L.e, "\\", "stretch-backslash"),
      expr("stretch-rep", L.b, ["3", { text: "+", kind: "plus" }, "2"]),
      sym(L.d, "°", "stretch-deg"),
      sym(L.g, "·", "stretch-dot"),
      sym(L.f, "@", "stretch-at"),
      sym(L.h, "*", "stretch-star"),
    ],
  },
  programming: {
    theme: "programming",
    heroPlacement: "left",
    glyphs: [
      expr("code-brackets", L.c, ["<", "/", ">"]),
      sym(L.a, "{", "code-lbrace"),
      sym(L.e, "}", "code-rbrace"),
      expr("code-hash", L.b, ["#", { text: "+", kind: "plus" }, "1"]),
      sym(L.d, "=>", "code-arrow"),
      sym(L.g, ";", "code-semi"),
      sym(L.f, "@", "code-at"),
      expr("code-bits", L.h, ["2", "*", "3"]),
    ],
  },
  creative_project: {
    theme: "creative",
    heroPlacement: "corner",
    glyphs: [
      sym(L.c, "✳", "creative-burst"),
      expr("creative-mix", L.e, ["2", { text: "+", kind: "plus" }, "3"]),
      sym(L.a, "@", "creative-at"),
      sym(L.b, "~", "creative-wave"),
      sym(L.d, "#", "creative-hash"),
      sym(L.g, "·", "creative-dot"),
      sym(L.f, "*", "creative-star"),
      expr("creative-mark", L.h, ["_", "%"]),
    ],
  },
  walking: {
    theme: "walking",
    heroPlacement: "right",
    glyphs: [
      sym(L.c, "→", "walk-arrow"),
      expr("walk-steps", L.a, ["1", { text: "+", kind: "plus" }, "2"]),
      sym(L.e, "~", "walk-wave"),
      sym(L.b, "·", "walk-dot"),
      sym(L.d, "/", "walk-slash"),
      sym(L.g, "@", "walk-at"),
      sym(L.f, "*", "walk-star"),
      sym(L.h, "%", "walk-pct"),
    ],
  },
  "variant-0": {
    theme: "variant-0",
    heroPlacement: "center",
    glyphs: [
      expr("v0-expr", L.c, ["2", { text: "+", kind: "plus" }, "3"]),
      sym(L.a, "@", "v0-at"),
      sym(L.e, "*", "v0-star"),
      sym(L.b, "%", "v0-pct"),
      sym(L.d, "_", "v0-us"),
      sym(L.g, "·", "v0-dot"),
      sym(L.f, "/", "v0-slash"),
      sym(L.h, "~", "v0-wave"),
    ],
  },
  "variant-1": {
    theme: "variant-1",
    heroPlacement: "left",
    glyphs: [
      sym(L.c, "#", "v1-hash"),
      expr("v1-expr", L.e, ["7", { text: "+", kind: "plus" }, "1"]),
      sym(L.a, "@", "v1-at"),
      sym(L.b, "*", "v1-star"),
      sym(L.d, "?", "v1-q"),
      sym(L.g, "_", "v1-us"),
      sym(L.f, "·", "v1-dot"),
      sym(L.h, "%", "v1-pct"),
    ],
  },
  "variant-2": {
    theme: "variant-2",
    heroPlacement: "right",
    glyphs: [
      sym(L.c, "&", "v2-amp"),
      expr("v2-expr", L.a, ["4", { text: "+", kind: "plus" }, "6"]),
      sym(L.e, "@", "v2-at"),
      sym(L.b, "~", "v2-wave"),
      sym(L.d, "*", "v2-star"),
      sym(L.g, "/", "v2-slash"),
      sym(L.f, "·", "v2-dot"),
      sym(L.h, "_", "v2-us"),
    ],
  },
};

const TEMPLATE_ART: Partial<Record<HabitTemplateId, HomeModalHeaderArtKey>> = {
  books: "books",
  running: "running",
  plank: "plank",
};

const CATEGORY_ART: Partial<Record<HabitCategoryKey, HomeModalHeaderArtKey>> = {
  meditation: "meditation",
  gratitude: "gratitude",
  stretching: "stretching",
  programming: "programming",
  creative_project: "creative_project",
  walking: "walking",
};

function hashHabitId(habitId: string): number {
  let hash = 0;
  for (let index = 0; index < habitId.length; index += 1) {
    hash = (hash * 31 + habitId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function resolveHomeModalHeaderArtKey(input: {
  templateId?: string | null;
  categoryKey?: string | null;
  habitId: string;
}): HomeModalHeaderArtKey {
  if (input.templateId && input.templateId in TEMPLATE_ART) {
    return TEMPLATE_ART[input.templateId as HabitTemplateId]!;
  }

  if (input.categoryKey && input.categoryKey in CATEGORY_ART) {
    return CATEGORY_ART[input.categoryKey as HabitCategoryKey]!;
  }

  const variants: HomeModalHeaderArtKey[] = ["variant-0", "variant-1", "variant-2"];
  return variants[hashHabitId(input.habitId) % variants.length] ?? "variant-0";
}

export function getHomeModalHeaderArt(artKey: HomeModalHeaderArtKey): HomeModalHeaderArt {
  return HOME_MODAL_HEADER_ART[artKey];
}

export function getHomeModalHeaderGlyphs(artKey: HomeModalHeaderArtKey): HomeModalGlyph[] {
  return getHomeModalHeaderArt(artKey).glyphs;
}
