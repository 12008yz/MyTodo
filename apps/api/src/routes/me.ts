import type { FastifyInstance } from "fastify";
import { patchMeRequestSchema, userProfileSchema } from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import { toUserProfile } from "../lib/user-mapper.js";
import type { UserService } from "../services/auth.js";
import type { HabitService } from "../services/habits.js";

export async function registerMeRoutes(
  app: FastifyInstance,
  userService: UserService,
  habitService: HabitService,
): Promise<void> {
  app.get(
    "/api/v1/me",
    {
      preHandler: authenticate,
    },
    async (request) => {
      const user = await userService.getById(request.userId);
      return userProfileSchema.parse(toUserProfile(user));
    },
  );

  app.patch(
    "/api/v1/me",
    {
      preHandler: authenticate,
    },
    async (request) => {
      const body = patchMeRequestSchema.parse(request.body);
      const user = await userService.updateProfile(request.userId, body);
      if (body.free_time_min !== undefined) {
        await habitService.recalibrateLightGoals(user);
      }
      return userProfileSchema.parse(toUserProfile(user));
    },
  );

  app.get(
    "/api/v1/me/export",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const archive = await userService.buildExportArchive(request.userId);
      return reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", 'attachment; filename="novaya-glava-export.zip"')
        .send(archive);
    },
  );

  app.delete(
    "/api/v1/me",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      await userService.deleteAccount(request.userId);
      return reply.status(204).send();
    },
  );
}
