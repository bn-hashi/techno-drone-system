import { describe, it, expect } from "vitest";
import { AGREEMENT_TEXT } from "@/lib/constants/agreementText";

describe("lib/constants/agreementText", () => {
  it("test_AGREEMENT_TEXT_is_exported_as_string", () => {
    // Assert
    expect(typeof AGREEMENT_TEXT).toBe("string");
  });

  it("test_AGREEMENT_TEXT_is_not_empty", () => {
    // Assert
    expect(AGREEMENT_TEXT.length).toBeGreaterThan(0);
  });

  it("test_AGREEMENT_TEXT_contains_minimum_content", () => {
    // Assert - 受講規約として最低限「規約」または「同意」という語を含む
    expect(AGREEMENT_TEXT).toMatch(/規約|同意|利用/);
  });
});
