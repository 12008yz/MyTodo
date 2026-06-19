import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies local defaults in test", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    expect(env.DATABASE_URL).toContain("localhost");
    expect(env.REDIS_URL).toContain("localhost");
  });

  it("requires explicit URLs in production", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow();
  });
});
