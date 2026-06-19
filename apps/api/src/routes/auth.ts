import type { FastifyInstance } from "fastify";
import {
  authResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from "@mytodo/shared";
import type { AuthService } from "../services/auth.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  authService: AuthService,
): Promise<void> {
  app.post("/api/v1/auth/register", async (request, reply) => {
    const body = registerRequestSchema.parse(request.body);
    const result = await authService.register(body);

    const payload = authResponseSchema.parse({
      user: result.user,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });

    return reply.status(201).send(payload);
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);
    const result = await authService.login(body);

    const payload = authResponseSchema.parse({
      user: result.user,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });

    return reply.send(payload);
  });

  app.post("/api/v1/auth/refresh", async (request) => {
    const body = refreshRequestSchema.parse(request.body);
    const result = await authService.refresh(body.refresh_token);

    return authResponseSchema.parse({
      user: result.user,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const body = logoutRequestSchema.parse(request.body);
    await authService.logout(body.refresh_token);
    return reply.status(204).send();
  });
}
