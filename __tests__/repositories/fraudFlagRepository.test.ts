import { describe, it, expect, beforeEach, vi } from "vitest";
import { FraudFlagRepository } from "@/repositories/fraudFlagRepository";
import { FraudFlagType } from "@/types/prisma";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    fraudFlag: {
      create: mockCreate,
      findMany: mockFindMany,
    },
  }),
}));

describe("FraudFlagRepository", () => {
  let repository: FraudFlagRepository;

  const createInput = {
    userId: "user-1",
    type: FraudFlagType.TAB_LEAVE,
    description: "65 seconds away",
  };

  const mockFlag = {
    id: "flag-1",
    ...createInput,
    detectedAt: new Date(),
    resolvedAt: null,
  };

  beforeEach(() => {
    mockCreate.mockReset();
    mockFindMany.mockReset();
    repository = new FraudFlagRepository();
  });

  it("test_create_returns_created_flag", async () => {
    mockCreate.mockResolvedValue(mockFlag);

    const result = await repository.create(createInput);

    expect(result).toEqual(mockFlag);
  });

  it("test_create_passes_input_to_prisma", async () => {
    mockCreate.mockResolvedValue(mockFlag);

    await repository.create(createInput);

    expect(mockCreate).toHaveBeenCalledWith({ data: createInput });
  });

  describe("findByUser", () => {
    it("test_findByUser_returns_flags", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([mockFlag]);

      // Act
      const result = await repository.findByUser("user-1");

      // Assert
      expect(result).toEqual([mockFlag]);
    });

    it("test_findByUser_calls_prisma_with_userId_and_orderBy_detectedAt_desc", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      await repository.findByUser("user-1");

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { detectedAt: "desc" },
      });
    });

    it("test_findByUser_empty_returns_empty_array", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      const result = await repository.findByUser("user-x");

      // Assert
      expect(result).toEqual([]);
    });
  });
});
