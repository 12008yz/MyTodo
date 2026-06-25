import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  completeHabitSessionRequestSchema,
  habitSessionActiveResponseSchema,
  habitSessionCompleteResponseSchema,
  habitSessionSchema,
  startHabitSessionRequestSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { RequireAccessHandler } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import type { HabitSessionService } from "../services/habit-sessions.js";

export async function registerHabitSessionRoutes(
  app: FastifyInstance,
  userService: UserService,
  habitSessionService: HabitSessionService,
  requireAccess: RequireAccessHandler,
): Promise<void> {
  const sessionPreHandlers = [authenticate, requireAccess];
  app.post(
    "/api/v1/habits/:id/sessions/start",
    { preHandler: sessionPreHandlers },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = startHabitSessionRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const session = await habitSessionService.start(user, params.id, {
        blockId: body.block_id,
        plannedMin: body.planned_min,
      });
      return reply.status(201).send(habitSessionSchema.parse(session));
    },
  );

  app.post(
    "/api/v1/habits/:id/sessions/complete",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = completeHabitSessionRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const result = await habitSessionService.complete(user, params.id, {
        blockId: body.block_id,
        actualValue: body.actual_value,
        endedEarly: body.ended_early,
      });
      return habitSessionCompleteResponseSchema.parse(result);
    },
  );

  app.post(
    "/api/v1/habits/:id/sessions/stop",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await habitSessionService.stop(request.userId, params.id);
      return habitSessionSchema.parse(session);
    },
  );

  app.post(
    "/api/v1/habits/:id/sessions/pause",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await habitSessionService.pause(request.userId, params.id);
      return habitSessionSchema.parse(session);
    },
  );

  app.post(
    "/api/v1/habits/:id/sessions/resume",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await habitSessionService.resume(request.userId, params.id);
      return habitSessionSchema.parse(session);
    },
  );

  app.get(
    "/api/v1/habits/:id/sessions/active",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await habitSessionService.getActive(request.userId, params.id);
      return habitSessionActiveResponseSchema.parse({ session });
    },
  );
}
