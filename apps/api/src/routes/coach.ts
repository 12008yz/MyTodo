import type { FastifyInstance } from "fastify";
import { coachChatRequestSchema, coachChatResponseSchema } from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { RequireAccessHandler } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import type { CoachService } from "../services/coach.js";

export async function registerCoachRoutes(
  app: FastifyInstance,
  userService: UserService,
  coachService: CoachService,
  requireAccess: RequireAccessHandler,
): Promise<void> {
  app.post(
    "/api/v1/coach/chat",
    { preHandler: [authenticate, requireAccess] },
    async (request) => {
      const body = coachChatRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const result = await coachService.chat(user, body);
      return coachChatResponseSchema.parse(result);
    },
  );
}
