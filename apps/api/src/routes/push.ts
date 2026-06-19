import type { FastifyInstance } from "fastify";
import {
  pushSubscribeRequestSchema,
  pushSubscribeResponseSchema,
  pushTestResponseSchema,
  pushUnsubscribeRequestSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { RequireAccessHandler } from "../plugins/require-access.js";
import type { PushService } from "../services/push.js";

export async function registerPushRoutes(
  app: FastifyInstance,
  pushService: PushService,
  requireAccess: RequireAccessHandler,
): Promise<void> {
  const preHandlers = [authenticate, requireAccess];

  app.post(
    "/api/v1/push/subscribe",
    { preHandler: preHandlers },
    async (request, reply) => {
      const body = pushSubscribeRequestSchema.parse(request.body);
      const result = await pushService.subscribe(request.userId, body);
      return reply.status(201).send(pushSubscribeResponseSchema.parse(result));
    },
  );

  app.delete(
    "/api/v1/push/subscribe",
    { preHandler: preHandlers },
    async (request, reply) => {
      const body = pushUnsubscribeRequestSchema.parse(request.body ?? {});
      await pushService.unsubscribe(request.userId, body.endpoint);
      return reply.status(204).send();
    },
  );

  app.post(
    "/api/v1/push/test",
    { preHandler: preHandlers },
    async (request) => {
      const sent = await pushService.sendTest(request.userId);
      return pushTestResponseSchema.parse({ sent });
    },
  );
}
