import { describe, expect, it } from "vitest";
import {
  canEnableSilenceMode,
  effectiveHarshnessLevel,
  isSilenceModeActive,
  SILENCE_MODE_COOLDOWN_DAYS,
} from "./silence-mode.js";

describe("silence mode", () => {
  it("detects active silence window", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const until = new Date("2026-06-16T12:00:00Z");
    expect(isSilenceModeActive(until, now)).toBe(true);
    expect(isSilenceModeActive(until, until)).toBe(false);
  });

  it("forces soft harshness while silence is active", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const until = new Date("2026-06-16T12:00:00Z");
    expect(effectiveHarshnessLevel(3, until, now)).toBe(1);
    expect(effectiveHarshnessLevel(3, null, now)).toBe(3);
  });

  it("allows first silence activation", () => {
    expect(canEnableSilenceMode(null, new Date())).toBe(true);
  });

  it("blocks silence within cooldown", () => {
    const usedAt = new Date("2026-06-01T12:00:00Z");
    const tooEarly = new Date("2026-06-20T12:00:00Z");
    expect(canEnableSilenceMode(usedAt, tooEarly)).toBe(false);
  });

  it("allows silence after cooldown", () => {
    const usedAt = new Date("2026-06-01T12:00:00Z");
    const ok = new Date(usedAt);
    ok.setDate(ok.getDate() + SILENCE_MODE_COOLDOWN_DAYS);
    expect(canEnableSilenceMode(usedAt, ok)).toBe(true);
  });
});
