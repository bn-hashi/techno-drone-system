import { describe, it, expect, beforeEach, vi } from "vitest";
import { QuestionRepository } from "@/repositories/questionRepository";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockCreateMany = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    question: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      createMany: mockCreateMany,
      update: mockUpdate,
      delete: mockDelete,
    },
  }),
}));

describe("QuestionRepository", () => {
  let repository: QuestionRepository;

  const mockQuestion = {
    id: "q-1",
    subjectId: "subject-1",
    body: "問題本文",
    choices: ["A", "B", "C"],
    correctIndex: 0,
    explanation: "解説",
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
    mockFindFirst.mockReset();
    mockCreate.mockReset();
    mockCreateMany.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    repository = new QuestionRepository();
  });

  describe("findAll", () => {
    it("test_findAll_no_filter_returns_questions", async () => {
      mockFindMany.mockResolvedValue([mockQuestion]);

      const result = await repository.findAll();

      expect(result).toEqual([mockQuestion]);
    });

    it("test_findAll_no_filter_calls_prisma_with_undefined_where", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll();

      expect(mockFindMany).toHaveBeenCalledWith({ where: undefined, take: 500 });
    });

    it("test_findAll_with_subject_filter", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll({ subjectId: "subject-1" });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { subjectId: "subject-1" },
        take: 500,
      });
    });
  });

  describe("findById", () => {
    it("test_findById_existing_returns_question", async () => {
      mockFindUnique.mockResolvedValue(mockQuestion);

      const result = await repository.findById("q-1");

      expect(result).toEqual(mockQuestion);
    });

    it("test_findById_nonexistent_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("q-x");

      expect(result).toBeNull();
    });
  });

  describe("findBySubjectAndBody", () => {
    it("test_findBySubjectAndBody_returns_existing", async () => {
      mockFindFirst.mockResolvedValue(mockQuestion);

      const result = await repository.findBySubjectAndBody("subject-1", "問題本文");

      expect(result).toEqual(mockQuestion);
    });

    it("test_findBySubjectAndBody_calls_prisma_with_exact_match", async () => {
      mockFindFirst.mockResolvedValue(null);

      await repository.findBySubjectAndBody("subject-1", "問題本文");

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { subjectId: "subject-1", body: "問題本文" },
      });
    });
  });

  describe("create", () => {
    it("test_create_returns_created_question", async () => {
      mockCreate.mockResolvedValue(mockQuestion);

      const result = await repository.create({
        subjectId: "subject-1",
        body: "問題本文",
        choices: ["A", "B", "C"],
        correctIndex: 0,
        explanation: "解説",
      });

      expect(result).toEqual(mockQuestion);
    });
  });

  describe("createMany", () => {
    it("test_createMany_creates_each_question_in_array", async () => {
      mockCreate.mockResolvedValue(mockQuestion);

      const inputs = [
        {
          subjectId: "subject-1",
          body: "問題1",
          choices: ["A", "B", "C"],
          correctIndex: 0,
          explanation: "解説1",
        },
        {
          subjectId: "subject-1",
          body: "問題2",
          choices: ["X", "Y", "Z"],
          correctIndex: 2,
          explanation: "解説2",
        },
      ];

      await repository.createMany(inputs);

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe("update", () => {
    it("test_update_returns_updated_question", async () => {
      const updated = { ...mockQuestion, body: "更新後" };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.update("q-1", { body: "更新後" });

      expect(result).toEqual(updated);
    });
  });

  describe("delete", () => {
    it("test_delete_calls_prisma_delete", async () => {
      mockDelete.mockResolvedValue(mockQuestion);

      await repository.delete("q-1");

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "q-1" } });
    });
  });

  describe("findManyByIds", () => {
    it("test_findManyByIds_returns_matching_questions", async () => {
      // Arrange
      const q2 = { ...mockQuestion, id: "q-2", body: "問題2" };
      mockFindMany.mockResolvedValue([mockQuestion, q2]);

      // Act
      const result = await repository.findManyByIds(["q-1", "q-2"]);

      // Assert
      expect(result).toEqual([mockQuestion, q2]);
    });

    it("test_findManyByIds_calls_prisma_with_in_clause", async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);

      // Act
      await repository.findManyByIds(["q-1", "q-2"]);

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { id: { in: ["q-1", "q-2"] } },
      });
    });

    it("test_findManyByIds_empty_input_returns_empty_array", async () => {
      // Act
      const result = await repository.findManyByIds([]);

      // Assert
      expect(result).toEqual([]);
    });

    it("test_findManyByIds_empty_input_does_not_query_prisma", async () => {
      // Act
      await repository.findManyByIds([]);

      // Assert: 空配列での無駄クエリを避ける
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("test_findManyByIds_with_tx_uses_tx_instead_of_getPrisma", async () => {
      // Arrange
      const txFindMany = vi.fn().mockResolvedValue([mockQuestion]);
      const txClient = { question: { findMany: txFindMany } };

      // Act
      await repository.findManyByIds(["q-1"], txClient as never);

      // Assert
      expect(txFindMany).toHaveBeenCalledWith({
        where: { id: { in: ["q-1"] } },
      });
    });
  });
});
