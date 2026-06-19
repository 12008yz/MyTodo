import { describe, expect, it } from "vitest";
import { DOMAIN_PACKAGE } from "./index.js";

describe("domain package", () => {
  it("is scaffolded", () => {
    expect(DOMAIN_PACKAGE).toBe("@mytodo/domain");
  });
});
