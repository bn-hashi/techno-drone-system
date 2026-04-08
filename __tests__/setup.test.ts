import { describe, it, expect } from "vitest";

describe("Vitest 基盤の動作確認", () => {
  it("test_vitest_runs_successfully", () => {
    // Arrange / Act
    const result = 1 + 1;

    // Assert
    expect(result).toBe(2);
  });

  it("test_vitest_async_works", async () => {
    // Arrange
    const value = Promise.resolve(42);

    // Act
    const result = await value;

    // Assert
    expect(result).toBe(42);
  });

  it("test_vitest_object_matching", () => {
    // Arrange
    const obj = { name: "drone-school", version: "0.1.0" };

    // Assert
    expect(obj).toMatchObject({ name: "drone-school" });
  });
});
