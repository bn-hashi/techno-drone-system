import { describe, it, expect, beforeEach, vi } from "vitest";
import { JudgmentRecordRepository } from "@/repositories/judgmentRecordRepository";
import { JudgmentResult } from "@/types/prisma";

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    judgmentRecord: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      create: mockCreate,
    },
  }),
}));

describe("JudgmentRecordRepository", () => {
  let repository: JudgmentRecordRepository;

  const acceptedRecord = {
    id: "j-1",
    userId: "user-1",
    result: JudgmentResult.ACCEPTED,
    comment: "全科目充足、視聴ログ良好",
    judgedBy: "管理者A",
    judgedAt: new Date("2026-05-25T01:00:00Z"),
  };

  const rejectedRecord = {
    id: "j-2",
    userId: "user-1",
    result: JudgmentResult.REJECTED,
    comment: null,
    judgedBy: "管理者A",
    judgedAt: new Date("2026-05-24T01:00:00Z"),
  };

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindFirst.mockReset();
    mockCreate.mockReset();
    repository = new JudgmentRecordRepository();
  });

  describe("create", () => {
    it("test_create_returns_persisted_record", async () => {
      // Arrange
      mockCreate.mockResolvedValue(acceptedRecord);

      // Act
      const result = await repository.create({
        userId: "user-1",
        result: JudgmentResult.ACCEPTED,
        comment: "全科目充足、視聴ログ良好",
        judgedBy: "管理者A",
      });

      // Assert
      expect(result).toEqual(acceptedRecord);
    });

    it("test_create_calls_prisma_with_input", async () => {
      // Arrange
      mockCreate.mockResolvedValue(acceptedRecord);

      // Act
      await repository.create({
        userId: "user-1",
        result: JudgmentResult.ACCEPTED,
        comment: "全科目充足、視聴ログ良好",
        judgedBy: "管理者A",
      });

      // Assert
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          result: JudgmentResult.ACCEPTED,
          comment: "全科目充足、視聴ログ良好",
          judgedBy: "管理者A",
        },
      });
    });

    it("test_create_with_null_comment_passes_null", async () => {
      // Arrange
      mockCreate.mockResolvedValue(rejectedRecord);

      // Act
      await repository.create({
        userId: "user-1",
        result: JudgmentResult.REJECTED,
        judgedBy: "管理者A",
      });

      // Assert
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          result: JudgmentResult.REJECTED,
          comment: undefined,
          judgedBy: "管理者A",
        },
      });
    });

    it("test_create_with_tx_uses_tx_instead_of_getPrisma", async () => {
      // Arrange
      const txCreate = vi.fn().mockResolvedValue(acceptedRecord);
      const txClient = { judgmentRecord: { create: txCreate } };

      // Act
      await repository.create(
        {
          userId: "user-1",
          result: JudgmentResult.ACCEPTED,
          judgedBy: "管理者A",
        },
        txClient as never
      );

      // Assert
      expect(txCreate).toHaveBeenCalledOnce();
    });
  });

  describe("findByUser", () => {
    it("test_findByUser_returns_records_ordered_desc", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([acceptedRecord, rejectedRecord]);

      // Act
      const result = await repository.findByUser("user-1");

      // Assert
      expect(result).toEqual([acceptedRecord, rejectedRecord]);
    });

    it("test_findByUser_calls_prisma_with_userId_and_orderBy_desc", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      await repository.findByUser("user-1");

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { judgedAt: "desc" },
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

  describe("findLatestByUser", () => {
    it("test_findLatestByUser_returns_latest_record", async () => {
      // Arrange
      mockFindFirst.mockResolvedValue(acceptedRecord);

      // Act
      const result = await repository.findLatestByUser("user-1");

      // Assert
      expect(result).toEqual(acceptedRecord);
    });

    it("test_findLatestByUser_calls_prisma_with_userId_and_first_desc", async () => {
      // Arrange
      mockFindFirst.mockResolvedValue(null);

      // Act
      await repository.findLatestByUser("user-1");

      // Assert
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { judgedAt: "desc" },
      });
    });

    it("test_findLatestByUser_no_record_returns_null", async () => {
      // Arrange
      mockFindFirst.mockResolvedValue(null);

      // Act
      const result = await repository.findLatestByUser("user-x");

      // Assert
      expect(result).toBeNull();
    });
  });
});
