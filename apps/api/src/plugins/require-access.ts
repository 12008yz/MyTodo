import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError, ERROR_CODES, HTTP_STATUS } from "@mytodo/shared";
import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { users } from "../db/schema/index.js";
import type { BillingService } from "../services/billing.js";

export type RequireAccessHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export function createRequireAccess(
  db: Database,
  billingService: BillingService,
): RequireAccessHandler {
  return async function requireAccess(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (!user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, "Unauthorized");
    }

    const hasAccess = await billingService.userHasAccess(user);
    if (!hasAccess) {
      throw new ApiError(
        HTTP_STATUS.PAYMENT_REQUIRED,
        ERROR_CODES.PAYMENT_REQUIRED,
        "Subscription or trial required",
      );
    }
  };
}
