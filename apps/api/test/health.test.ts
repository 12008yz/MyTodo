import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { healthResponseSchema } from "@mytodo/shared";

describe("GET /api/v1/health", () => {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: "test",
  });

  let app: Awaited<ReturnType<typeof buildApp>>["app"];

  beforeAll(async () => {
    const built = await buildApp({ env });
    app = built.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health payload with db and redis status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);

    const body = healthResponseSchema.parse(JSON.parse(response.body));
    expect(body).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded)$/),
      db: expect.stringMatching(/^(ok|error)$/),
      redis: expect.stringMatching(/^(ok|error)$/),
    });
  });
});
