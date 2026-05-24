import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExamRepository } from "@/repositories/examRepository";
import { ExamStatus } from "@/types/prisma";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    exam: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
    },
  }),
}));

describe("ExamRepository", () => {
  let repository: ExamRepository;

  const mockExam = {
    id: "exam-1",
    userId: "user-1",
    startedAt: new Date(),
    endedAt: null,
    score: null,
    totalQuestions: 30,
    passed: null,
    status: ExamStatus.IN_PROGRESS,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindFirst.mockReset();
    mockFindMany.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    repository = new ExamRepository();
  });

  describe("findById", () => {
    it("test_findById_existing_returns_exam", async () => {
      mockFindUnique.mockResolvedValue(mockExam);

      const result = await repository.findById("exam-1");

      expect(result).toEqual(mockExam);
    });

    it("test_findById_nonexistent_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("exam-x");

      expect(result).toBeNull();
    });

    it("test_findById_calls_prisma_with_id", async () => {
      mockFindUnique.mockResolvedValue(null);

      await repository.findById("exam-1");

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "exam-1" } });
    });
  });

  describe("findByUserAndStatus", () => {
    it("test_findByUserAndStatus_returns_exam", async () => {
      mockFindFirst.mockResolvedValue(mockExam);

      const result = await repository.findByUserAndStatus("user-1", ExamStatus.IN_PROGRESS);

      expect(result).toEqual(mockExam);
    });

    it("test_findByUserAndStatus_calls_prisma_with_filter", async () => {
      mockFindFirst.mockResolvedValue(null);

      await repository.findByUserAndStatus("user-1", ExamStatus.IN_PROGRESS);

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", status: ExamStatus.IN_PROGRESS },
      });
    });

    it("test_findByUserAndStatus_nonexistent_returns_null", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await repository.findByUserAndStatus("user-x", ExamStatus.IN_PROGRESS);

      expect(result).toBeNull();
    });
  });

  describe("findAllWithUser", () => {
    it("test_findAllWithUser_returns_exams_with_user", async () => {
      const examWithUser = {
        ...mockExam,
        user: { id: "user-1", name: "山田", email: "y@example.com" },
      };
      mockFindMany.mockResolvedValue([examWithUser]);

      const result = await repository.findAllWithUser();

      expect(result).toEqual([examWithUser]);
    });

    it("test_findAllWithUser_selects_only_safe_user_fields", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAllWithUser();

      expect(mockFindMany).toHaveBeenCalledWith({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { startedAt: "desc" },
      });
    });
  });

  describe("findByUserOrderByStartedAtDesc", () => {
    it("test_findByUser_returns_user_exams", async () => {
      mockFindMany.mockResolvedValue([mockExam]);

      const result = await repository.findByUserOrderByStartedAtDesc("user-1");

      expect(result).toEqual([mockExam]);
    });

    it("test_findByUser_orders_by_startedAt_desc", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findByUserOrderByStartedAtDesc("user-1");

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { startedAt: "desc" },
      });
    });
  });

  describe("create", () => {
    it("test_create_returns_created_exam", async () => {
      mockCreate.mockResolvedValue(mockExam);

      const result = await repository.create({
        userId: "user-1",
        totalQuestions: 30,
        questionIds: ["q-1", "q-2"],
      });

      expect(result).toEqual(mockExam);
    });

    it("test_create_passes_input_to_prisma", async () => {
      mockCreate.mockResolvedValue(mockExam);

      await repository.create({
        userId: "user-1",
        totalQuestions: 30,
        questionIds: ["q-1", "q-2"],
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: { userId: "user-1", totalQuestions: 30, questionIds: ["q-1", "q-2"] },
      });
    });
  });

  describe("update", () => {
    it("test_update_returns_updated_exam", async () => {
      const updated = {
        ...mockExam,
        score: 90,
        passed: true,
        status: ExamStatus.PASSED,
        endedAt: new Date(),
      };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.update("exam-1", {
        score: 90,
        passed: true,
        status: ExamStatus.PASSED,
        endedAt: updated.endedAt as Date,
      });

      expect(result).toEqual(updated);
    });

    it("test_update_calls_prisma_with_data", async () => {
      mockUpdate.mockResolvedValue(mockExam);

      await repository.update("exam-1", { score: 80, passed: true, status: ExamStatus.PASSED });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "exam-1" },
        data: { score: 80, passed: true, status: ExamStatus.PASSED },
      });
    });
  });
});
