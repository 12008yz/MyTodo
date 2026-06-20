import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  adminClosePledgeRequestSchema,
  adminEnglishLessonsResponseSchema,
  adminPushBroadcastRequestSchema,
  adminPushBroadcastResponseSchema,
  adminUserDetailSchema,
  adminUsersListResponseSchema,
  adminUsersQuerySchema,
  createEnglishLessonRequestSchema,
  englishLessonSchema,
  patchEnglishLessonRequestSchema,
  pledgeResponseSchema,
} from "@mytodo/shared";
import type { RequireAdminHandler } from "../plugins/require-admin.js";
import type { AdminService } from "../services/admin.js";
import type { PushService } from "../services/push.js";

export async function registerAdminRoutes(
  app: FastifyInstance,
  adminService: AdminService,
  pushService: PushService,
  requireAdmin: RequireAdminHandler,
): Promise<void> {
  app.get(
    "/api/v1/admin/users",
    { preHandler: [requireAdmin] },
    async (request) => {
      const query = adminUsersQuerySchema.parse(request.query);
      const result = await adminService.listUsers(query);
      return adminUsersListResponseSchema.parse(result);
    },
  );

  app.get(
    "/api/v1/admin/users/:id",
    { preHandler: [requireAdmin] },
    async (request) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await adminService.getUser(id);
      return adminUserDetailSchema.parse(result);
    },
  );

  app.patch(
    "/api/v1/admin/pledges/:id",
    { preHandler: [requireAdmin] },
    async (request) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = adminClosePledgeRequestSchema.parse(request.body);
      request.log.info(
        {
          event: "admin_action",
          action: "close_pledge",
          admin_id: request.userId,
          pledge_id: id,
          status: body.status,
        },
        "admin closed pledge",
      );
      const result = await adminService.closePledge(id, body);
      return pledgeResponseSchema.parse(result);
    },
  );

  app.get(
    "/api/v1/admin/english/lessons",
    { preHandler: [requireAdmin] },
    async () => {
      const result = await adminService.listEnglishLessons();
      return adminEnglishLessonsResponseSchema.parse(result);
    },
  );

  app.post(
    "/api/v1/admin/english/lessons",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const body = createEnglishLessonRequestSchema.parse(request.body);
      request.log.info(
        {
          event: "admin_action",
          action: "create_english_lesson",
          admin_id: request.userId,
          day_number: body.day_number,
        },
        "admin created english lesson",
      );
      const result = await adminService.createEnglishLesson(body);
      return reply.status(201).send(englishLessonSchema.parse(result));
    },
  );

  app.patch(
    "/api/v1/admin/english/lessons/:id",
    { preHandler: [requireAdmin] },
    async (request) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = patchEnglishLessonRequestSchema.parse(request.body);
      request.log.info(
        {
          event: "admin_action",
          action: "update_english_lesson",
          admin_id: request.userId,
          lesson_id: id,
        },
        "admin updated english lesson",
      );
      const result = await adminService.updateEnglishLesson(id, body);
      return englishLessonSchema.parse(result);
    },
  );

  app.delete(
    "/api/v1/admin/english/lessons/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      request.log.info(
        {
          event: "admin_action",
          action: "delete_english_lesson",
          admin_id: request.userId,
          lesson_id: id,
        },
        "admin deleted english lesson",
      );
      await adminService.deleteEnglishLesson(id);
      return reply.status(204).send();
    },
  );

  app.post(
    "/api/v1/admin/push/broadcast",
    { preHandler: [requireAdmin] },
    async (request) => {
      const body = adminPushBroadcastRequestSchema.parse(request.body);
      request.log.info(
        {
          event: "admin_action",
          action: "push_broadcast",
          admin_id: request.userId,
          filter: body.filter,
        },
        "admin broadcast push",
      );
      const userIds = await adminService.resolveBroadcastUserIds(body.filter);
      const result = await pushService.broadcast(userIds, body.text);
      return adminPushBroadcastResponseSchema.parse(result);
    },
  );
}
