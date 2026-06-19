import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createPledgePaymentResponseSchema,
  createPledgeRequestSchema,
  pledgeResponseSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { RequireAccessHandler } from "../plugins/require-access.js";
import type { PledgeService } from "../services/pledges.js";

export async function registerPledgeRoutes(
  app: FastifyInstance,
  pledgeService: PledgeService,
  requireAccess: RequireAccessHandler,
): Promise<void> {
  const preHandlers = [authenticate, requireAccess];

  app.get(
    "/api/v1/pledges",
    { preHandler: preHandlers },
    async (request) => {
      const items = await pledgeService.listByUser(request.userId);
      return z.array(pledgeResponseSchema).parse(items);
    },
  );

  app.post(
    "/api/v1/pledges",
    { preHandler: preHandlers },
    async (request, reply) => {
      const body = createPledgeRequestSchema.parse(request.body);
      const result = await pledgeService.createPayment(request.userId, body);
      return reply.status(201).send(createPledgePaymentResponseSchema.parse(result));
    },
  );
}
