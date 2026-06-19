import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  doomScrollActiveResponseSchema,
  doomScrollSessionSchema,
  doomScrollStopResponseSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import { requireAccess } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import type { DoomScrollService } from "../services/doom-scroll.js";

const sessionPreHandlers = [authenticate, requireAccess];

export async function registerDoomScrollRoutes(
  app: FastifyInstance,
  userService: UserService,
  doomScrollService: DoomScrollService,
): Promise<void> {
  app.post(
    "/api/v1/habits/:id/doom-scroll/start",
    { preHandler: sessionPreHandlers },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const user = await userService.getById(request.userId);
      const session = await doomScrollService.start(user, params.id);
      return reply.status(201).send(doomScrollSessionSchema.parse(session));
    },
  );

  app.post(
    "/api/v1/habits/:id/doom-scroll/stop",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const user = await userService.getById(request.userId);
      const result = await doomScrollService.stop(user, params.id);
      return doomScrollStopResponseSchema.parse(result);
    },
  );

  app.get(
    "/api/v1/habits/:id/doom-scroll/active",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await doomScrollService.getActive(request.userId, params.id);
      return doomScrollActiveResponseSchema.parse({ session });
    },
  );
}
