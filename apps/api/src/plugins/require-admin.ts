import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError, ERROR_CODES, HTTP_STATUS } from "@mytodo/shared";
import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { users } from "../db/schema/index.js";
import { authenticate } from "./authenticate.js";

export type RequireAdminHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export function createRequireAdmin(db: Database): RequireAdminHandler {
  return async function requireAdmin(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    await authenticate(request, reply);

    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (!user || user.role !== "admin") {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, "Admin access required");
    }
  };
}
