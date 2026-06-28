import { describe, expect, it, vi, afterEach } from "vitest";
import { isDemoMode } from "./demo-mode";

describe("isDemoMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off in development even when VITE_DEMO_MODE=true", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.stubEnv("MODE", "development");
    vi.stubEnv("VITE_DEMO_MODE", "true");
    vi.stubEnv("VITE_API_URL", "");

    expect(isDemoMode()).toBe(false);
  });

  it("is on for vite demo mode", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.stubEnv("MODE", "demo");
    vi.stubEnv("VITE_DEMO_MODE", "true");

    expect(isDemoMode()).toBe(true);
  });

  it("is on for production static deploy without API URL", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_DEMO_MODE", "");
    vi.stubEnv("VITE_API_URL", "");

    expect(isDemoMode()).toBe(true);
  });

  it("is off in production when API URL is set", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_DEMO_MODE", "");
    vi.stubEnv("VITE_API_URL", "https://api.example.com");

    expect(isDemoMode()).toBe(false);
  });
});
