import type { FastifyInstance } from "fastify";
import {
  englishCatalogResponseSchema,
  englishCompleteRequestSchema,
  englishCompleteResponseSchema,
  englishHistoryResponseSchema,
  englishSelectLessonRequestSchema,
  englishSelectLessonResponseSchema,
  englishSettingsResponseSchema,
  englishSkipResponseSchema,
  englishTodayResponseSchema,
  englishWatchRequestSchema,
  englishWatchResponseSchema,
  patchEnglishSettingsRequestSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { RequireAccessHandler } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import type { EnglishService } from "../services/english.js";

export async function registerEnglishRoutes(
  app: FastifyInstance,
  userService: UserService,
  englishService: EnglishService,
  requireAccess: RequireAccessHandler,
): Promise<void> {
  const englishPreHandlers = [authenticate, requireAccess];
  app.get(
    "/api/v1/english/today",
    { preHandler: englishPreHandlers },
    async (request) => {
      const user = await userService.getById(request.userId);
      const payload = await englishService.getToday(user);
      return englishTodayResponseSchema.parse(payload);
    },
  );

  app.get(
    "/api/v1/english/catalog",
    { preHandler: englishPreHandlers },
    async (request) => {
      const user = await userService.getById(request.userId);
      const payload = await englishService.getCatalog(user);
      return englishCatalogResponseSchema.parse(payload);
    },
  );

  app.post(
    "/api/v1/english/watch",
    { preHandler: englishPreHandlers },
    async (request) => {
      const body = englishWatchRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const payload = await englishService.recordWatch(user, body.watched_sec);
      return englishWatchResponseSchema.parse(payload);
    },
  );

  app.post(
    "/api/v1/english/select",
    { preHandler: englishPreHandlers },
    async (request) => {
      const body = englishSelectLessonRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const payload = await englishService.selectLesson(user, body.lesson_id);
      return englishSelectLessonResponseSchema.parse(payload);
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
