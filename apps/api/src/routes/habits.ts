import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createHabitRequestSchema,
  habitResponseSchema,
  patchHabitRequestSchema,
} from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { UserService } from "../services/auth.js";
import { HabitService } from "../services/habits.js";

const listHabitsQuerySchema = z.object({
  side: z.enum(["light", "dark"]).optional(),
});

export async function registerHabitRoutes(
  app: FastifyInstance,
  userService: UserService,
  habitService: HabitService,
): Promise<void> {
  app.get(
    "/api/v1/habits",
    { preHandler: authenticate },
    async (request) => {
      const query = listHabitsQuerySchema.parse(request.query);
      const items = await habitService.list(request.userId, query.side);
      return z.array(habitResponseSchema).parse(items);
    },
  );

  app.post(
    "/api/v1/habits",
    { preHandler: authenticate },
    async (request, reply) => {
      const body = createHabitRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const habit = await habitService.create(user, body);
      return reply.status(201).send(habitResponseSchema.parse(habit));
    },
  );

  app.patch(
    "/api/v1/habits/:id",
    { preHandler: authenticate },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = patchHabitRequestSchema.parse(request.body);
      const habit = await habitService.update(request.userId, params.id, body);
      return habitResponseSchema.parse(habit);
    },
  );

  app.delete(
    "/api/v1/habits/:id",
    { preHandler: authenticate },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const habit = await habitService.deactivate(request.userId, params.id);
      return habitResponseSchema.parse(habit);
    },
  );
}
