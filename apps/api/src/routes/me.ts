import type { FastifyInstance } from "fastify";
import { patchMeRequestSchema, userProfileSchema } from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import { toUserProfile } from "../lib/user-mapper.js";
import type { UserService } from "../services/auth.js";

export async function registerMeRoutes(
  app: FastifyInstance,
  userService: UserService,
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
      return userProfileSchema.parse(toUserProfile(user));
    },
  );
}
