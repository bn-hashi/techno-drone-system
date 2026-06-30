import { describe, it, expect, beforeEach, vi } from "vitest";
import { FraudFlagRepository } from "@/repositories/fraudFlagRepository";
import { FraudFlagType } from "@/types/prisma";
import type { FraudFlagWithUser } from "@/repositories/fraudFlagRepository";

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

  describe("findAll", () => {
    const mockFlagWithUser: FraudFlagWithUser = {
      id: "flag-1",
      userId: "user-1",
      type: FraudFlagType.TAB_LEAVE,
      description: "65 seconds away",
      detectedAt: new Date("2026-01-01T10:00:00Z"),
      resolvedAt: null,
      user: { id: "user-1", name: "田中太郎", email: "tanaka@example.com" },
    };

    it("test_findAll_returns_all_flags_with_user", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([mockFlagWithUser]);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toEqual([mockFlagWithUser]);
    });

    it("test_findAll_returns_empty_array_when_no_flags", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toEqual([]);
    });

    it("test_findAll_calls_prisma_with_orderBy_detectedAt_desc_and_user_include", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      await repository.findAll();

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        orderBy: { detectedAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });
  });
});
