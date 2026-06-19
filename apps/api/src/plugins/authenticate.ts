import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError, ERROR_CODES, HTTP_STATUS } from "@mytodo/shared";

export type JwtPayload = {
  sub: string;
};

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await request.jwtVerify<JwtPayload>();
    request.userId = payload.sub;
  } catch {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, "Unauthorized");
  }
}

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}
