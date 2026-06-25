import { describe, expect, it } from "vitest";
import {
  getLiveSessionProgress,
  getLiveSessionProgressLabel,
} from "./sessionProgress";

describe("getLiveSessionProgress", () => {
  it("adds fractional minutes during session", () => {
    expect(getLiveSessionProgress("minutes", 90)).toBe(1.5);
  });

  it("adds fractional pages at 2 minutes per page", () => {
    expect(getLiveSessionProgress("pages", 60)).toBe(0.5);
    expect(getLiveSessionProgress("pages", 120)).toBe(1);
    expect(getLiveSessionProgress("pages", 300)).toBe(2.5);
  });

  it("returns 0 for unsupported units", () => {
    expect(getLiveSessionProgress("reps", 120)).toBe(0);
  });
});

describe("getLiveSessionProgressLabel", () => {
  it("floors pages at 2-minute boundaries", () => {
    expect(getLiveSessionProgressLabel("pages", 119)).toBe(0);
    expect(getLiveSessionProgressLabel("pages", 120)).toBe(1);
    expect(getLiveSessionProgressLabel("pages", 239)).toBe(1);
    expect(getLiveSessionProgressLabel("pages", 240)).toBe(2);
  });
});
