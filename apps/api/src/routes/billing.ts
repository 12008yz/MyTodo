import type { FastifyInstance } from "fastify";
import {
  cancelSubscriptionResponseSchema,
  subscribeRequestSchema,
  subscribeResponseSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { BillingService } from "../services/billing.js";

export async function registerBillingRoutes(
  app: FastifyInstance,
  billingService: BillingService,
): Promise<void> {
  app.post(
    "/api/v1/billing/subscribe",
    { preHandler: authenticate },
    async (request, reply) => {
      const body = subscribeRequestSchema.parse(request.body);
      const result = await billingService.subscribe(request.userId, body);
      return reply.status(201).send(subscribeResponseSchema.parse(result));
    },
  );

  app.post(
    "/api/v1/billing/cancel",
    { preHandler: authenticate },
    async (request) => {
      const result = await billingService.cancel(request.userId);
      return cancelSubscriptionResponseSchema.parse(result);
    },
  );

  app.post("/api/v1/billing/webhook", async (request, reply) => {
    const rawBody =
      typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {});
    const signature = request.headers["x-yookassa-signature"] as string | undefined;

    await billingService.handleWebhook(rawBody, signature);
    return reply.status(200).send({ ok: true });
  });
}
