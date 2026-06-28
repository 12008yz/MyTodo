import { describe, expect, it } from "vitest";
import { ClientApiError } from "../../lib/api";
import { formatSessionError } from "./sessionErrors";

describe("formatSessionError", () => {
  it("translates known API session errors", () => {
    expect(
      formatSessionError(
        new ClientApiError("Session is too short to complete", 400, "VALIDATION_ERROR"),
      ),
    ).toBe("Сессия слишком короткая — подождите ещё несколько секунд");
  });

  it("normalizes demo Russian session errors", () => {
    expect(formatSessionError(new Error("Активная сессия не найдена"))).toBe(
      "Активная сессия не найдена — попробуйте начать заново",
    );
  });

  it("passes through unknown messages", () => {
    expect(formatSessionError(new Error("Сеть недоступна"))).toBe("Сеть недоступна");
  });
});
