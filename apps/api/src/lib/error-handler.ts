import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { ERROR_CODES, HTTP_STATUS, isApiError } from "@mytodo/shared";
import { captureException } from "./sentry.js";

export function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof ZodError) {
    void reply.status(HTTP_STATUS.BAD_REQUEST).send({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Validation failed",
        details: error.flatten(),
      },
    });
    return;
  }

  if (isApiError(error)) {
    void reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  const statusCode =
    "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : HTTP_STATUS.INTERNAL_SERVER_ERROR;

  if (statusCode >= 500) {
    captureException(error);
  }

  void reply.status(statusCode).send({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: statusCode >= 500 ? "Internal server error" : error.message,
    },
  });
}
