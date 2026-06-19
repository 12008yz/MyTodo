import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  batchCheckinRequestSchema,
  batchCheckinResponseSchema,
  checkinResponseSchema,
  createCheckinRequestSchema,
  listCheckinsQuerySchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { RequireAccessHandler } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import { CheckinService } from "../services/checkins.js";
import { toCheckinResponse } from "../lib/checkin-mapper.js";

export async function registerCheckinRoutes(
  app: FastifyInstance,
  userService: UserService,
  checkinService: CheckinService,
  requireAccess: RequireAccessHandler,
): Promise<void> {
  const checkinPreHandlers = [authenticate, requireAccess];
  app.get(
    "/api/v1/checkins",
    { preHandler: checkinPreHandlers },
    async (request) => {
      const query = listCheckinsQuerySchema.parse(request.query);
      const items = await checkinService.listByDate(request.userId, query.date);
      return z.array(checkinResponseSchema).parse(items);
    },
  );

  app.post(
    "/api/v1/checkins",
    { preHandler: checkinPreHandlers },
    async (request, reply) => {
      const body = createCheckinRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const result = await checkinService.upsert(user, body);

      return reply.status(result.created ? 201 : 200).send(
        checkinResponseSchema.parse(
          toCheckinResponse(result.checkin, result.currentGoal, result.previewNextGoal),
        ),
      );
    },
  );

  app.post(
    "/api/v1/checkins/batch",
    { preHandler: checkinPreHandlers },
    async (request, reply) => {
      const body = batchCheckinRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const results = await checkinService.batchUpsert(user, body);

      const payload = {
        checkins: results.map((result) =>
          toCheckinResponse(result.checkin, result.currentGoal, result.previewNextGoal),
        ),
      };

      return reply.status(201).send(batchCheckinResponseSchema.parse(payload));
    },
  );
}
