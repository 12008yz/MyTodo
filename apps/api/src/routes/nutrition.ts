import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  habitNutritionLogSchema,
  nutritionTodayResponseSchema,
  putNutritionTodayRequestSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { RequireAccessHandler } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import type { NutritionLogService } from "../services/nutrition-log.js";

export async function registerNutritionRoutes(
  app: FastifyInstance,
  userService: UserService,
  nutritionLogService: NutritionLogService,
  requireAccess: RequireAccessHandler,
): Promise<void> {
  const preHandlers = [authenticate, requireAccess];

  app.get(
    "/api/v1/habits/:id/nutrition/today",
    { preHandler: preHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const user = await userService.getById(request.userId);
      const log = await nutritionLogService.getTodayLog(user, params.id);
      return nutritionTodayResponseSchema.parse({ log });
    },
  );

  app.put(
    "/api/v1/habits/:id/nutrition/today",
    { preHandler: preHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = putNutritionTodayRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const log = await nutritionLogService.upsertTodayLog(user, params.id, body);
      return habitNutritionLogSchema.parse(log);
    },
  );
}
