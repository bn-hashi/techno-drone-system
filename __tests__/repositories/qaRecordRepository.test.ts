import { describe, it, expect, beforeEach, vi } from "vitest";
import { QARecordRepository } from "@/repositories/qaRecordRepository";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    qARecord: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
    },
  }),
}));

describe("QARecordRepository", () => {
  let repository: QARecordRepository;

  const baseRecord = {
    id: "qa-1",
    userId: "user-1",
    question: "受講中に不明点があったらどうすればよいですか？",
    answer: null,
    questionedAt: new Date("2026-05-25T00:00:00Z"),
    answeredAt: null,
    answeredBy: null,
  };

  const answeredRecord = {
    ...baseRecord,
    id: "qa-2",
    answer: "本フォームから何度でも質問してください。",
    answeredAt: new Date("2026-05-25T01:00:00Z"),
    answeredBy: "管理者A",
  };

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindMany.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    repository = new QARecordRepository();
  });

  describe("findById", () => {
    it("test_findById_existing_returns_record", async () => {
      mockFindUnique.mockResolvedValue(baseRecord);

      const result = await repository.findById("qa-1");

      expect(result).toEqual(baseRecord);
    });

    it("test_findById_nonexistent_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("qa-x");

      expect(result).toBeNull();
    });

    it("test_findById_calls_prisma_with_id", async () => {
      mockFindUnique.mockResolvedValue(null);

      await repository.findById("qa-1");

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "qa-1" } });
    });
  });

  describe("findByUser", () => {
    it("test_findByUser_returns_records", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([answeredRecord, baseRecord]);

      // Act
      const result = await repository.findByUser("user-1");

      // Assert
      expect(result).toEqual([answeredRecord, baseRecord]);
    });

    it("test_findByUser_calls_prisma_with_userId_and_orderBy_desc", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      await repository.findByUser("user-1");

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { questionedAt: "desc" },
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

  describe("findAllWithUser", () => {
    const withUser = {
      ...baseRecord,
      user: { id: "user-1", name: "山田太郎", email: "y@example.com" },
    };

    it("test_findAllWithUser_no_filter_returns_records", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([withUser]);

      // Act
      const result = await repository.findAllWithUser();

      // Assert
      expect(result).toEqual([withUser]);
    });

    it("test_findAllWithUser_no_filter_calls_prisma_with_user_select_only", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      await repository.findAllWithUser();

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { questionedAt: "desc" },
      });
    });

    it("test_findAllWithUser_unanswered_only_filter_filters_by_null_answer", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      await repository.findAllWithUser({ unansweredOnly: true });

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { answer: null },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { questionedAt: "desc" },
      });
    });

    it("test_findAllWithUser_unanswered_only_false_returns_all", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      await repository.findAllWithUser({ unansweredOnly: false });

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { questionedAt: "desc" },
      });
    });
  });

  describe("create", () => {
    it("test_create_returns_persisted_record", async () => {
      // Arrange
      mockCreate.mockResolvedValue(baseRecord);

      // Act
      const result = await repository.create({
        userId: "user-1",
        question: "受講中に不明点があったらどうすればよいですか？",
      });

      // Assert
      expect(result).toEqual(baseRecord);
    });

    it("test_create_calls_prisma_with_userId_and_question", async () => {
      // Arrange
      mockCreate.mockResolvedValue(baseRecord);

      // Act
      await repository.create({
        userId: "user-1",
        question: "受講中に不明点があったらどうすればよいですか？",
      });

      // Assert
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          question: "受講中に不明点があったらどうすればよいですか？",
        },
      });
    });
  });

  describe("updateAnswer", () => {
    const answeredAt = new Date("2026-05-25T01:00:00Z");
    const input = {
      answer: "本フォームから何度でも質問してください。",
      answeredAt,
      answeredBy: "管理者A",
    };

    it("test_updateAnswer_returns_updated_record", async () => {
      // Arrange
      mockUpdate.mockResolvedValue(answeredRecord);

      // Act
      const result = await repository.updateAnswer("qa-2", input);

      // Assert
      expect(result).toEqual(answeredRecord);
    });

    it("test_updateAnswer_calls_prisma_with_id_and_answer_fields", async () => {
      // Arrange
      mockUpdate.mockResolvedValue(answeredRecord);

      // Act
      await repository.updateAnswer("qa-2", input);

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "qa-2" },
        data: {
          answer: "本フォームから何度でも質問してください。",
          answeredAt,
          answeredBy: "管理者A",
        },
      });
    });
  });
});
