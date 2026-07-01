import { describe, expect, it } from "vitest";
import {
  HOME_MODAL_HEADER_ART,
  getHomeModalHeaderGlyphs,
  resolveHomeModalHeaderArtKey,
} from "./homeModalHeaderArt";

describe("resolveHomeModalHeaderArtKey", () => {
  it("maps templates and categories to unique art keys", () => {
    expect(
      resolveHomeModalHeaderArtKey({
        templateId: "books",
        categoryKey: null,
        habitId: "h1",
      }),
    ).toBe("books");

    expect(
      resolveHomeModalHeaderArtKey({
        templateId: null,
        categoryKey: "meditation",
        habitId: "h2",
      }),
    ).toBe("meditation");

    expect(
      resolveHomeModalHeaderArtKey({
        templateId: null,
        categoryKey: "programming",
        habitId: "h3",
      }),
    ).toBe("programming");
  });

  it("falls back to stable variants for unknown habits", () => {
    const first = resolveHomeModalHeaderArtKey({
      templateId: null,
      categoryKey: null,
      habitId: "custom-42",
    });
    const second = resolveHomeModalHeaderArtKey({
      templateId: null,
      categoryKey: null,
      habitId: "custom-42",
    });

    expect(first).toMatch(/^variant-/);
    expect(second).toBe(first);
  });
});

describe("getHomeModalHeaderGlyphs", () => {
  it("returns unique glyph sets per habit art", () => {
    const meditation = getHomeModalHeaderGlyphs("meditation").map((glyph) => glyph.id);
    const books = getHomeModalHeaderGlyphs("books").map((glyph) => glyph.id);
    const programming = getHomeModalHeaderGlyphs("programming").map((glyph) => glyph.id);

    expect(meditation).not.toEqual(books);
    expect(books).not.toEqual(programming);
    expect(meditation.length).toBe(8);
  });

  it("uses unique layout slots per art", () => {
    for (const artKey of Object.keys(HOME_MODAL_HEADER_ART)) {
      const layouts = getHomeModalHeaderGlyphs(
        artKey as keyof typeof HOME_MODAL_HEADER_ART,
      ).map((glyph) => glyph.layout);
      expect(new Set(layouts).size).toBe(layouts.length);
    }
  });

  it("includes expressions and symbols for each habit", () => {
    const texts = getHomeModalHeaderGlyphs("meditation").flatMap((glyph) =>
      glyph.segments.map((segment) => segment.text),
    );

    expect(texts).toContain("+");
    expect(texts).toContain("@");
    expect(texts).toContain("*");
    expect(texts).toContain("%");
    expect(texts).toContain("○");
  });
});
