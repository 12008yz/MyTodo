import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiError,
  ERROR_CODES,
  HTTP_STATUS,
  statsCalendarQuerySchema,
  statsCalendarResponseSchema,
  statsMonthQuerySchema,
  statsMonthResponseSchema,
  statsProgressQuerySchema,
  statsProgressResponseSchema,
  statsSummaryQuerySchema,
  statsSummaryResponseSchema,
  statsWeekQuerySchema,
  statsWeekResponseSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import { requireAccess } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import { StatsService } from "../services/stats.js";

const statsPreHandlers = [authenticate, requireAccess];

export async function registerStatsRoutes(
  app: FastifyInstance,
  userService: UserService,
  statsService: StatsService,
): Promise<void> {
  app.get(
    "/api/v1/stats/week",
    { preHandler: statsPreHandlers },
    async (request) => {
      const query = statsWeekQuerySchema.parse(request.query);
      const user = await userService.getById(request.userId);
      const payload = await statsService.getWeek(user, query.side, query.week_start);
      return statsWeekResponseSchema.parse(payload);
    },
  );

  app.get(
    "/api/v1/stats/calendar",
    { preHandler: statsPreHandlers },
    async (request) => {
      const query = statsCalendarQuerySchema.parse(request.query);
      const user = await userService.getById(request.userId);
      const payload = await statsService.getCalendar(user, query.month, query.side);
      return statsCalendarResponseSchema.parse(payload);
    },
  );

  app.get(
    "/api/v1/stats/month",
    { preHandler: statsPreHandlers },
    async (request) => {
      const query = statsMonthQuerySchema.parse(request.query);
      const user = await userService.getById(request.userId);
      const payload = await statsService.getMonthSummary(user, query.month, query.side);
      return statsMonthResponseSchema.parse(payload);
    },
  );

  app.get(
    "/api/v1/stats/habits/:id/progress",
    { preHandler: statsPreHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const query = statsProgressQuerySchema.parse(request.query);
      const user = await userService.getById(request.userId);
      const payload = await statsService.getHabitProgress(user, params.id, query.period);

      if (!payload) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, "Habit not found");
      }

      return statsProgressResponseSchema.parse(payload);
    },
  );

  app.get(
    "/api/v1/stats/summary",
    { preHandler: statsPreHandlers },
    async (request) => {
      const query = statsSummaryQuerySchema.parse(request.query);
      const user = await userService.getById(request.userId);
      const payload = await statsService.getSummary(user, query.weeks);
      return statsSummaryResponseSchema.parse(payload);
    },
  );
}
