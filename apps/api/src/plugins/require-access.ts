import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAccess(
  _request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // Stub until block 10 (subscription / trial access checks).
}
