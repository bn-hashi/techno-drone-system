import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { FraudFlagService } from "@/services/fraudFlagService";
import type { IFraudFlagRepository, FraudFlagWithUser } from "@/repositories/fraudFlagRepository";
import { FraudFlagType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

describe("FraudFlagService", () => {
  let service: FraudFlagService;
  let mockRepo: Mocked<IFraudFlagRepository>;

  const mockFlag = {
    id: "flag-1",
    userId: "user-1",
    type: FraudFlagType.TAB_LEAVE,
    description: "65 seconds",
    detectedAt: new Date(),
    resolvedAt: null,
  };

  const mockFlagWithUser: FraudFlagWithUser = {
    id: "flag-1",
    userId: "user-1",
    type: FraudFlagType.TAB_LEAVE,
    description: "65 seconds",
    detectedAt: new Date("2026-01-01T10:00:00Z"),
    resolvedAt: null,
    user: { id: "user-1", name: "田中太郎", email: "tanaka@example.com" },
  };

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findByUser: vi.fn(),
      findAll: vi.fn(),
    } as Mocked<IFraudFlagRepository>;
    service = new FraudFlagService(mockRepo);
  });

  it("test_flagTabLeave_returns_created_flag", async () => {
    mockRepo.create.mockResolvedValue(mockFlag);

    const result = await service.flagTabLeave("user-1", 65);

    expect(result).toEqual(mockFlag);
  });

  it("test_flagTabLeave_calls_repo_with_TAB_LEAVE_type", async () => {
    mockRepo.create.mockResolvedValue(mockFlag);

    await service.flagTabLeave("user-1", 65);

    expect(mockRepo.create).toHaveBeenCalledWith({
      userId: "user-1",
      type: FraudFlagType.TAB_LEAVE,
      description: "タブ離脱 65 秒",
    });
  });

  it("test_flagTabLeave_negative_duration_throws_BusinessError", async () => {
    await expect(service.flagTabLeave("user-1", -1)).rejects.toThrow(BusinessError);
  });

  it("test_flagTabLeave_under_60_seconds_throws_BusinessError", async () => {
    await expect(service.flagTabLeave("user-1", 59)).rejects.toThrow(BusinessError);
  });

  it("test_flagTabLeave_exactly_60_seconds_throws_BusinessError", async () => {
    // 仕様「60秒超」のため 60 ジャストは不可
    await expect(service.flagTabLeave("user-1", 60)).rejects.toThrow(BusinessError);
  });

  it("test_flagTabLeave_61_seconds_succeeds", async () => {
    mockRepo.create.mockResolvedValue(mockFlag);

    await expect(service.flagTabLeave("user-1", 61)).resolves.toBeDefined();
  });

  describe("listAllFlags", () => {
    it("test_listAllFlags_returns_all_flags_from_repo", async () => {
      // Arrange
      mockRepo.findAll.mockResolvedValue([mockFlagWithUser]);

      // Act
      const result = await service.listAllFlags();

      // Assert
      expect(result).toEqual([mockFlagWithUser]);
    });

    it("test_listAllFlags_returns_empty_array_when_no_flags", async () => {
      // Arrange
      mockRepo.findAll.mockResolvedValue([]);

      // Act
      const result = await service.listAllFlags();

      // Assert
      expect(result).toEqual([]);
    });

    it("test_listAllFlags_delegates_to_repo_findAll", async () => {
      // Arrange
      mockRepo.findAll.mockResolvedValue([]);

      // Act
      await service.listAllFlags();

      // Assert
      expect(mockRepo.findAll).toHaveBeenCalledOnce();
    });
  });
});
