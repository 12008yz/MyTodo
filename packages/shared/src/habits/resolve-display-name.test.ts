import { describe, expect, it } from "vitest";
import { resolveHabitDisplayName } from "./resolve-display-name.js";

describe("resolveHabitDisplayName", () => {
  it("uses the current template name for template habits", () => {
    expect(
      resolveHabitDisplayName({
        name: "Читать книги",
        template_id: "books",
        is_custom: false,
      }),
    ).toBe("Чтение книг");
  });

  it("keeps custom habit names", () => {
    expect(
      resolveHabitDisplayName({
        name: "Моя книга",
        is_custom: true,
      }),
    ).toBe("Моя книга");
  });
});
