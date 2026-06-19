import type { FastifyInstance } from "fastify";
import {
  englishCompleteRequestSchema,
  englishCompleteResponseSchema,
  englishHistoryResponseSchema,
  englishSettingsResponseSchema,
  englishSkipResponseSchema,
  englishTodayResponseSchema,
  patchEnglishSettingsRequestSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import { requireAccess } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import type { EnglishService } from "../services/english.js";

const englishPreHandlers = [authenticate, requireAccess];

export async function registerEnglishRoutes(
  app: FastifyInstance,
  userService: UserService,
  englishService: EnglishService,
): Promise<void> {
  app.get(
    "/api/v1/english/today",
    { preHandler: englishPreHandlers },
    async (request) => {
      const user = await userService.getById(request.userId);
      const payload = await englishService.getToday(user);
      return englishTodayResponseSchema.parse(payload);
    },
  );

  app.post(
    "/api/v1/english/complete",
    { preHandler: englishPreHandlers },
    async (request) => {
      const body = englishCompleteRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const payload = await englishService.complete(user, body.watched_sec);
      return englishCompleteResponseSchema.parse(payload);
    },
  );

  app.post(
    "/api/v1/english/skip",
    { preHandler: englishPreHandlers },
    async (request) => {
      const user = await userService.getById(request.userId);
      const payload = await englishService.skip(user);
      return englishSkipResponseSchema.parse(payload);
    },
  );

  app.get(
    "/api/v1/english/history",
    { preHandler: englishPreHandlers },
    async (request) => {
      const user = await userService.getById(request.userId);
      const payload = await englishService.getHistory(user);
      return englishHistoryResponseSchema.parse(payload);
    },
  );

  app.patch(
    "/api/v1/english/settings",
    { preHandler: englishPreHandlers },
    async (request) => {
      const body = patchEnglishSettingsRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const payload = await englishService.updateSettings(user, body);
      return englishSettingsResponseSchema.parse(payload);
    },
  );
}
