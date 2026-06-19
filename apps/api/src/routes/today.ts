import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  habitTimerResponseSchema,
  todayDarkResponseSchema,
  todayLightResponseSchema,
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import { requireAccess } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import { TodayService } from "../services/today.js";

const todayPreHandlers = [authenticate, requireAccess];

export async function registerTodayRoutes(
  app: FastifyInstance,
  userService: UserService,
  todayService: TodayService,
): Promise<void> {
  app.get(
    "/api/v1/today/light",
    { preHandler: todayPreHandlers },
    async (request) => {
      const user = await userService.getById(request.userId);
      const payload = await todayService.getLightDashboard(user);
      return todayLightResponseSchema.parse(payload);
    },
  );

  app.get(
    "/api/v1/today/dark",
    { preHandler: todayPreHandlers },
    async (request) => {
      const user = await userService.getById(request.userId);
      const payload = await todayService.getDarkDashboard(user);
      return todayDarkResponseSchema.parse(payload);
    },
  );

  app.get(
    "/api/v1/habits/:id/timer",
    { preHandler: todayPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const timer = await todayService.getHabitTimer(request.userId, params.id);

      if (!timer) {
        const habitExists = await todayService.habitExists(request.userId, params.id);
        if (!habitExists) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Habit not found");
        }

        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Timer is only available for habits in abstinence phase with a relapse timestamp",
        );
      }

      return habitTimerResponseSchema.parse(timer);
    },
  );
}
