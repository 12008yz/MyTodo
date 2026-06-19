import { describe, expect, it } from "vitest";
import { ApiError, ERROR_CODES, HTTP_STATUS } from "./errors.js";

describe("ApiError", () => {
  it("stores status code and error code", () => {
    const error = new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      "Invalid input",
    );

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Invalid input");
  });
});
