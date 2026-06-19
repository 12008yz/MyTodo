import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  pomodoroActiveResponseSchema,
  pomodoroCompleteResponseSchema,
  pomodoroSessionSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import { requireAccess } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import type { PomodoroService } from "../services/pomodoro.js";

const sessionPreHandlers = [authenticate, requireAccess];

export async function registerPomodoroRoutes(
  app: FastifyInstance,
  userService: UserService,
  pomodoroService: PomodoroService,
): Promise<void> {
  app.post(
    "/api/v1/habits/:id/pomodoro/start",
    { preHandler: sessionPreHandlers },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const user = await userService.getById(request.userId);
      const session = await pomodoroService.start(user, params.id);
      return reply.status(201).send(pomodoroSessionSchema.parse(session));
    },
  );

  app.post(
    "/api/v1/habits/:id/pomodoro/complete",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const user = await userService.getById(request.userId);
      const result = await pomodoroService.complete(user, params.id);
      return pomodoroCompleteResponseSchema.parse(result);
    },
  );

  app.post(
    "/api/v1/habits/:id/pomodoro/stop",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await pomodoroService.stop(request.userId, params.id);
      return pomodoroSessionSchema.parse(session);
    },
  );

  app.get(
    "/api/v1/habits/:id/pomodoro/active",
    { preHandler: sessionPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await pomodoroService.getActive(request.userId, params.id);
      return pomodoroActiveResponseSchema.parse({ session });
    },
  );
}
