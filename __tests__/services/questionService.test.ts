import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
  }),
}));

import { QuestionService } from "@/services/questionService";
import type { IQuestionRepository } from "@/repositories/questionRepository";
import type { ISubjectRepository } from "@/repositories/subjectRepository";
import { BusinessError, QuestionNotFoundError } from "@/services/errors";

describe("QuestionService", () => {
  let service: QuestionService;
  let mockQuestionRepo: Mocked<IQuestionRepository>;
  let mockSubjectRepo: Mocked<ISubjectRepository>;

  const subject1 = {
    id: "subject-1",
    code: "SUBJECT_01",
    name: "規則",
    requiredMinutesBeginner: 180,
    requiredMinutesExperienced: 60,
  };

  const mockQuestion = {
    id: "q-1",
    subjectId: "subject-1",
    body: "問題1",
    choices: ["A", "B", "C"],
    correctIndex: 0,
    explanation: "解説1",
    createdAt: new Date(),
  };

  const validInput = {
    subjectId: "subject-1",
    body: "問題1",
    choices: ["A", "B", "C"],
    correctIndex: 0,
    explanation: "解説1",
  };

  beforeEach(() => {
    mockQuestionRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findManyByIds: vi.fn(),
      findBySubjectAndBody: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as Mocked<IQuestionRepository>;

    mockSubjectRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      updateRequiredMinutes: vi.fn(),
    } as Mocked<ISubjectRepository>;

    service = new QuestionService(mockQuestionRepo, mockSubjectRepo);
  });

  describe("createQuestion", () => {
    it("test_createQuestion_valid_returns_question", async () => {
      mockSubjectRepo.findById.mockResolvedValue(subject1);
      mockQuestionRepo.create.mockResolvedValue(mockQuestion);

      const result = await service.createQuestion(validInput);

      expect(result).toEqual(mockQuestion);
    });

    it("test_createQuestion_unknown_subject_throws_BusinessError", async () => {
      mockSubjectRepo.findById.mockResolvedValue(null);

      await expect(service.createQuestion(validInput)).rejects.toThrow(BusinessError);
    });

    it("test_createQuestion_empty_body_throws_BusinessError", async () => {
      mockSubjectRepo.findById.mockResolvedValue(subject1);

      await expect(service.createQuestion({ ...validInput, body: "  " })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_createQuestion_wrong_choice_count_throws_BusinessError", async () => {
      mockSubjectRepo.findById.mockResolvedValue(subject1);

      await expect(service.createQuestion({ ...validInput, choices: ["A", "B"] })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_createQuestion_correctIndex_out_of_range_throws_BusinessError", async () => {
      mockSubjectRepo.findById.mockResolvedValue(subject1);

      await expect(service.createQuestion({ ...validInput, correctIndex: 3 })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_createQuestion_negative_correctIndex_throws_BusinessError", async () => {
      mockSubjectRepo.findById.mockResolvedValue(subject1);

      await expect(service.createQuestion({ ...validInput, correctIndex: -1 })).rejects.toThrow(
        BusinessError
      );
    });
  });

  describe("updateQuestion", () => {
    it("test_updateQuestion_nonexistent_throws_QuestionNotFoundError", async () => {
      mockQuestionRepo.findById.mockResolvedValue(null);

      await expect(service.updateQuestion("q-x", { body: "更新" })).rejects.toThrow(
        QuestionNotFoundError
      );
    });

    it("test_updateQuestion_valid_returns_updated", async () => {
      const updated = { ...mockQuestion, body: "更新" };
      mockQuestionRepo.findById.mockResolvedValue(mockQuestion);
      mockQuestionRepo.update.mockResolvedValue(updated);

      const result = await service.updateQuestion("q-1", { body: "更新" });

      expect(result).toEqual(updated);
    });

    it("test_updateQuestion_empty_body_throws_BusinessError", async () => {
      mockQuestionRepo.findById.mockResolvedValue(mockQuestion);

      await expect(service.updateQuestion("q-1", { body: "  " })).rejects.toThrow(BusinessError);
    });

    it("test_updateQuestion_unknown_subject_throws_BusinessError", async () => {
      // input.subjectId が指定された場合は科目存在チェックを行う
      mockQuestionRepo.findById.mockResolvedValue(mockQuestion);
      mockSubjectRepo.findById.mockResolvedValue(null);

      await expect(service.updateQuestion("q-1", { subjectId: "subject-x" })).rejects.toThrow(
        BusinessError
      );
    });
  });

  describe("deleteQuestion", () => {
    it("test_deleteQuestion_nonexistent_throws_QuestionNotFoundError", async () => {
      mockQuestionRepo.findById.mockResolvedValue(null);

      await expect(service.deleteQuestion("q-x")).rejects.toThrow(QuestionNotFoundError);
    });

    it("test_deleteQuestion_existing_calls_delete", async () => {
      mockQuestionRepo.findById.mockResolvedValue(mockQuestion);

      await service.deleteQuestion("q-1");

      expect(mockQuestionRepo.delete).toHaveBeenCalledWith("q-1");
    });
  });

  describe("importFromCsv", () => {
    const validCsv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,問1,A,B,C,1,解説1
SUBJECT_01,問2,X,Y,Z,2,解説2`;

    it("test_importFromCsv_valid_returns_imported_count", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);
      mockQuestionRepo.findBySubjectAndBody.mockResolvedValue(null);

      const result = await service.importFromCsv(validCsv);

      expect(result.imported).toBe(2);
    });

    it("test_importFromCsv_skips_existing_duplicates", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);
      // 1 件目はあるが 2 件目はない
      mockQuestionRepo.findBySubjectAndBody
        .mockResolvedValueOnce(mockQuestion)
        .mockResolvedValueOnce(null);

      const result = await service.importFromCsv(validCsv);

      expect(result.skipped).toBe(1);
    });

    it("test_importFromCsv_unknown_subject_throws_BusinessError", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);

      const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_99,問1,A,B,C,1,解説`;

      await expect(service.importFromCsv(csv)).rejects.toThrow(BusinessError);
    });

    it("test_importFromCsv_invalid_correctIndex_throws_BusinessError", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);

      const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,問1,A,B,C,5,解説`;

      await expect(service.importFromCsv(csv)).rejects.toThrow(BusinessError);
    });

    it("test_importFromCsv_empty_body_throws_BusinessError", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);

      const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,  ,A,B,C,1,解説`;

      await expect(service.importFromCsv(csv)).rejects.toThrow(BusinessError);
    });
  });
});
