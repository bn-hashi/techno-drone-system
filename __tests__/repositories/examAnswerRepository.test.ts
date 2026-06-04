import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExamAnswerRepository } from "@/repositories/examAnswerRepository";

const mockCreateMany = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    examAnswer: {
      createMany: mockCreateMany,
      findMany: mockFindMany,
    },
  }),
}));

describe("ExamAnswerRepository", () => {
  let repository: ExamAnswerRepository;

  const answer1 = {
    id: "ans-1",
    examId: "exam-1",
    questionId: "q-1",
    selectedIndex: 0,
    isCorrect: true,
  };
  const answer2 = {
    id: "ans-2",
    examId: "exam-1",
    questionId: "q-2",
    selectedIndex: 2,
    isCorrect: false,
  };

  beforeEach(() => {
    mockCreateMany.mockReset();
    mockFindMany.mockReset();
    repository = new ExamAnswerRepository();
  });

  describe("createMany", () => {
    it("test_createMany_creates_inputs", async () => {
      mockCreateMany.mockResolvedValue({ count: 2 });

      await repository.createMany([
        { examId: "exam-1", questionId: "q-1", selectedIndex: 0, isCorrect: true },
        { examId: "exam-1", questionId: "q-2", selectedIndex: 2, isCorrect: false },
      ]);

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          { examId: "exam-1", questionId: "q-1", selectedIndex: 0, isCorrect: true },
          { examId: "exam-1", questionId: "q-2", selectedIndex: 2, isCorrect: false },
        ],
      });
    });

    it("test_createMany_empty_array_does_not_call_prisma", async () => {
      await repository.createMany([]);

      expect(mockCreateMany).not.toHaveBeenCalled();
    });
  });

  describe("findByExamId", () => {
    it("test_findByExamId_returns_answers", async () => {
      mockFindMany.mockResolvedValue([answer1, answer2]);

      const result = await repository.findByExamId("exam-1");

      expect(result).toEqual([answer1, answer2]);
    });

    it("test_findByExamId_filters_by_examId", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findByExamId("exam-1");

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { examId: "exam-1" },
      });
    });
  });
});
