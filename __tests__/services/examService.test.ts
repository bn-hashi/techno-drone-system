import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
  }),
}));

import { ExamService } from "@/services/examService";
import type { IExamRepository } from "@/repositories/examRepository";
import type { IExamAnswerRepository } from "@/repositories/examAnswerRepository";
import type { IQuestionRepository } from "@/repositories/questionRepository";
import type { ISubjectRepository } from "@/repositories/subjectRepository";
import type { ProgressServiceLike, UserManagementServiceLike } from "@/services/examService";
import { BusinessError, NotFoundError } from "@/services/errors";
import { CourseType, ExamStatus, UserStatus } from "@/types/prisma";
import { EXAM_DURATION_MINUTES, PASSING_SCORE_THRESHOLD } from "@/lib/constants";

const subject1 = {
  id: "subject-1",
  code: "SUBJECT_01",
  name: "規則",
  requiredMinutesBeginner: 180,
  requiredMinutesExperienced: 60,
};
const subject2 = {
  id: "subject-2",
  code: "SUBJECT_02",
  name: "運用",
  requiredMinutesBeginner: 210,
  requiredMinutesExperienced: 90,
};

function makeQuestion(id: string, subjectId: string, correctIndex = 0) {
  return {
    id,
    subjectId,
    body: `${id} の本文`,
    choices: ["A", "B", "C"],
    correctIndex,
    explanation: `${id} の解説`,
    createdAt: new Date(),
  };
}

const fulfilledProgress = [
  {
    subjectId: subject1.id,
    subjectName: subject1.name,
    totalWatchedMinutes: 200,
    requiredMinutes: 180,
    isFulfilled: true,
  },
  {
    subjectId: subject2.id,
    subjectName: subject2.name,
    totalWatchedMinutes: 240,
    requiredMinutes: 210,
    isFulfilled: true,
  },
];

const insufficientProgress = [
  {
    subjectId: subject1.id,
    subjectName: subject1.name,
    totalWatchedMinutes: 60,
    requiredMinutes: 180,
    isFulfilled: false,
  },
  {
    subjectId: subject2.id,
    subjectName: subject2.name,
    totalWatchedMinutes: 240,
    requiredMinutes: 210,
    isFulfilled: true,
  },
];

describe("ExamService", () => {
  let service: ExamService;
  let mockExamRepo: Mocked<IExamRepository>;
  let mockAnswerRepo: Mocked<IExamAnswerRepository>;
  let mockQuestionRepo: Mocked<IQuestionRepository>;
  let mockSubjectRepo: Mocked<ISubjectRepository>;
  let mockProgressService: Mocked<ProgressServiceLike>;
  let mockUserManagementService: Mocked<UserManagementServiceLike>;

  beforeEach(() => {
    mockExamRepo = {
      findById: vi.fn(),
      findByUserAndStatus: vi.fn(),
      findAllWithUser: vi.fn(),
      findByUserOrderByStartedAtDesc: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    } as Mocked<IExamRepository>;

    mockAnswerRepo = {
      createMany: vi.fn(),
      findByExamId: vi.fn(),
    } as Mocked<IExamAnswerRepository>;

    mockQuestionRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
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

    mockProgressService = {
      getProgressByUser: vi.fn(),
    } as Mocked<ProgressServiceLike>;

    mockUserManagementService = {
      updateStatus: vi.fn(),
      getUserById: vi.fn(),
    } as Mocked<UserManagementServiceLike>;

    service = new ExamService(
      mockExamRepo,
      mockAnswerRepo,
      mockQuestionRepo,
      mockSubjectRepo,
      mockProgressService,
      mockUserManagementService
    );
  });

  describe("checkEligibility", () => {
    it("test_checkEligibility_all_fulfilled_returns_eligible_true", async () => {
      mockProgressService.getProgressByUser.mockResolvedValue(fulfilledProgress);

      const result = await service.checkEligibility("user-1", CourseType.BEGINNER);

      expect(result.eligible).toBe(true);
    });

    it("test_checkEligibility_returns_progress_list", async () => {
      mockProgressService.getProgressByUser.mockResolvedValue(fulfilledProgress);

      const result = await service.checkEligibility("user-1", CourseType.BEGINNER);

      expect(result.progress).toEqual(fulfilledProgress);
    });

    it("test_checkEligibility_insufficient_returns_eligible_false", async () => {
      mockProgressService.getProgressByUser.mockResolvedValue(insufficientProgress);

      const result = await service.checkEligibility("user-1", CourseType.BEGINNER);

      expect(result.eligible).toBe(false);
    });
  });

  describe("startExam", () => {
    const q1 = makeQuestion("q-1", subject1.id);
    const q2 = makeQuestion("q-2", subject1.id);
    const q3 = makeQuestion("q-3", subject2.id);
    const q4 = makeQuestion("q-4", subject2.id);

    function arrangeAllReady() {
      mockProgressService.getProgressByUser.mockResolvedValue(fulfilledProgress);
      mockExamRepo.findByUserAndStatus.mockResolvedValue(null);
      mockSubjectRepo.findAll.mockResolvedValue([subject1, subject2]);
      mockQuestionRepo.findAll.mockImplementation(async (filter) => {
        if (filter?.subjectId === subject1.id) return [q1, q2];
        if (filter?.subjectId === subject2.id) return [q3, q4];
        return [q1, q2, q3, q4];
      });
      mockExamRepo.create.mockResolvedValue({
        id: "exam-1",
        userId: "user-1",
        startedAt: new Date(),
        endedAt: null,
        score: null,
        totalQuestions: 4,
        questionIds: ["q-1", "q-2", "q-3", "q-4"],
        passed: null,
        status: ExamStatus.IN_PROGRESS,
        createdAt: new Date(),
      });
    }

    it("test_startExam_not_eligible_throws_BusinessError", async () => {
      mockProgressService.getProgressByUser.mockResolvedValue(insufficientProgress);

      await expect(service.startExam("user-1", CourseType.BEGINNER)).rejects.toThrow(BusinessError);
    });

    it("test_startExam_in_progress_existing_throws_BusinessError", async () => {
      mockProgressService.getProgressByUser.mockResolvedValue(fulfilledProgress);
      mockExamRepo.findByUserAndStatus.mockResolvedValue({
        id: "exam-existing",
      } as never);

      await expect(service.startExam("user-1", CourseType.BEGINNER)).rejects.toThrow(BusinessError);
    });

    it("test_startExam_creates_exam_with_total_question_count", async () => {
      arrangeAllReady();

      await service.startExam("user-1", CourseType.BEGINNER);

      expect(mockExamRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          totalQuestions: 4,
          questionIds: expect.arrayContaining(["q-1", "q-2", "q-3", "q-4"]),
        })
      );
    });

    it("test_startExam_returns_view_with_questions", async () => {
      arrangeAllReady();

      const result = await service.startExam("user-1", CourseType.BEGINNER);

      expect(result.questions).toHaveLength(4);
    });

    it("test_startExam_view_questions_dont_include_correctIndex", async () => {
      arrangeAllReady();

      const result = await service.startExam("user-1", CourseType.BEGINNER);

      expect(result.questions[0]).not.toHaveProperty("correctIndex");
    });

    it("test_startExam_view_has_duration_minutes", async () => {
      arrangeAllReady();

      const result = await service.startExam("user-1", CourseType.BEGINNER);

      expect(result.durationMinutes).toBe(EXAM_DURATION_MINUTES);
    });
  });

  describe("submitExam", () => {
    const examId = "exam-1";
    const userId = "user-1";

    function arrangeOwnedInProgressExam(
      startedAt = new Date(),
      totalQuestions = 2,
      questionIds: string[] = ["q-1", "q-2"]
    ) {
      mockExamRepo.findById.mockResolvedValue({
        id: examId,
        userId,
        startedAt,
        endedAt: null,
        score: null,
        totalQuestions,
        questionIds,
        passed: null,
        status: ExamStatus.IN_PROGRESS,
        createdAt: startedAt,
      } as never);
    }

    function arrangeQuestions(qs: ReturnType<typeof makeQuestion>[]) {
      mockQuestionRepo.findById.mockImplementation(
        async (id) => qs.find((q) => q.id === id) ?? null
      );
    }

    it("test_submitExam_exam_not_found_throws_NotFoundError", async () => {
      mockExamRepo.findById.mockResolvedValue(null);

      await expect(service.submitExam(userId, examId, [])).rejects.toThrow(NotFoundError);
    });

    it("test_submitExam_other_user_throws_BusinessError", async () => {
      mockExamRepo.findById.mockResolvedValue({
        id: examId,
        userId: "other-user",
        startedAt: new Date(),
        endedAt: null,
        score: null,
        totalQuestions: 2,
        questionIds: [],
        passed: null,
        status: ExamStatus.IN_PROGRESS,
        createdAt: new Date(),
      } as never);

      await expect(service.submitExam(userId, examId, [])).rejects.toThrow(BusinessError);
    });

    it("test_submitExam_already_submitted_throws_BusinessError", async () => {
      mockExamRepo.findById.mockResolvedValue({
        id: examId,
        userId,
        startedAt: new Date(),
        endedAt: new Date(),
        score: 80,
        totalQuestions: 2,
        questionIds: [],
        passed: true,
        status: ExamStatus.PASSED,
        createdAt: new Date(),
      } as never);

      await expect(service.submitExam(userId, examId, [])).rejects.toThrow(BusinessError);
    });

    it("test_submitExam_unknown_questionId_throws_BusinessError", async () => {
      arrangeOwnedInProgressExam(new Date(), 2, ["q-1", "q-2"]);

      await expect(
        service.submitExam(userId, examId, [{ questionId: "q-unknown", selectedIndex: 0 }])
      ).rejects.toThrow(BusinessError);
    });

    it("test_submitExam_unknown_questionId_does_not_persist", async () => {
      arrangeOwnedInProgressExam(new Date(), 2, ["q-1", "q-2"]);

      await service
        .submitExam(userId, examId, [{ questionId: "q-unknown", selectedIndex: 0 }])
        .catch(() => undefined);

      expect(mockAnswerRepo.createMany).not.toHaveBeenCalled();
    });

    it("test_submitExam_unknown_questionId_does_not_transition_user", async () => {
      arrangeOwnedInProgressExam(new Date(), 2, ["q-1", "q-2"]);

      await service
        .submitExam(userId, examId, [{ questionId: "q-unknown", selectedIndex: 0 }])
        .catch(() => undefined);

      expect(mockUserManagementService.updateStatus).not.toHaveBeenCalled();
    });

    it("test_submitExam_duplicate_questionId_throws_BusinessError", async () => {
      arrangeOwnedInProgressExam(new Date(), 2, ["q-1", "q-2"]);

      await expect(
        service.submitExam(userId, examId, [
          { questionId: "q-1", selectedIndex: 0 },
          { questionId: "q-1", selectedIndex: 0 },
        ])
      ).rejects.toThrow(BusinessError);
    });

    it("test_submitExam_duplicate_questionId_does_not_persist", async () => {
      arrangeOwnedInProgressExam(new Date(), 2, ["q-1", "q-2"]);

      await service
        .submitExam(userId, examId, [
          { questionId: "q-1", selectedIndex: 0 },
          { questionId: "q-1", selectedIndex: 0 },
        ])
        .catch(() => undefined);

      expect(mockAnswerRepo.createMany).not.toHaveBeenCalled();
    });

    it("test_submitExam_all_correct_passes_with_score_100", async () => {
      arrangeOwnedInProgressExam(new Date(), 2);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      const q2 = makeQuestion("q-2", subject2.id, 1);
      arrangeQuestions([q1, q2]);
      mockUserManagementService.getUserById.mockResolvedValue({
        id: userId,
        status: UserStatus.ACTIVE,
      } as never);
      mockExamRepo.update.mockImplementation(async (_id, input) => ({
        id: examId,
        userId,
        startedAt: new Date(),
        endedAt: input.endedAt ?? null,
        score: input.score ?? null,
        totalQuestions: 2,
        questionIds: [],
        passed: input.passed ?? null,
        status: input.status ?? ExamStatus.IN_PROGRESS,
        createdAt: new Date(),
      }));

      const result = await service.submitExam(userId, examId, [
        { questionId: "q-1", selectedIndex: 0 },
        { questionId: "q-2", selectedIndex: 1 },
      ]);

      expect(result.score).toBe(100);
    });

    it("test_submitExam_all_correct_passes_with_passed_true", async () => {
      arrangeOwnedInProgressExam(new Date(), 2);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      const q2 = makeQuestion("q-2", subject2.id, 1);
      arrangeQuestions([q1, q2]);
      mockUserManagementService.getUserById.mockResolvedValue({
        id: userId,
        status: UserStatus.ACTIVE,
      } as never);
      mockExamRepo.update.mockImplementation(async (_id, input) => ({
        id: examId,
        userId,
        startedAt: new Date(),
        endedAt: input.endedAt ?? null,
        score: input.score ?? null,
        totalQuestions: 2,
        questionIds: [],
        passed: input.passed ?? null,
        status: input.status ?? ExamStatus.IN_PROGRESS,
        createdAt: new Date(),
      }));

      const result = await service.submitExam(userId, examId, [
        { questionId: "q-1", selectedIndex: 0 },
        { questionId: "q-2", selectedIndex: 1 },
      ]);

      expect(result.passed).toBe(true);
    });

    it("test_submitExam_passing_transitions_user_to_EXAM_PASSED", async () => {
      arrangeOwnedInProgressExam(new Date(), 2);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      const q2 = makeQuestion("q-2", subject2.id, 1);
      arrangeQuestions([q1, q2]);
      mockUserManagementService.getUserById.mockResolvedValue({
        id: userId,
        status: UserStatus.ACTIVE,
      } as never);
      mockExamRepo.update.mockResolvedValue({} as never);

      await service.submitExam(userId, examId, [
        { questionId: "q-1", selectedIndex: 0 },
        { questionId: "q-2", selectedIndex: 1 },
      ]);

      expect(mockUserManagementService.updateStatus).toHaveBeenCalledWith(
        userId,
        UserStatus.EXAM_PASSED,
        expect.anything()
      );
    });

    it("test_submitExam_passing_passes_tx_to_updateStatus", async () => {
      arrangeOwnedInProgressExam(new Date(), 2);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      const q2 = makeQuestion("q-2", subject2.id, 1);
      arrangeQuestions([q1, q2]);
      mockUserManagementService.getUserById.mockResolvedValue({
        id: userId,
        status: UserStatus.ACTIVE,
      } as never);
      mockExamRepo.update.mockResolvedValue({} as never);

      await service.submitExam(userId, examId, [
        { questionId: "q-1", selectedIndex: 0 },
        { questionId: "q-2", selectedIndex: 1 },
      ]);

      const updateStatusCall = mockUserManagementService.updateStatus.mock.calls[0];
      // 第 3 引数が tx (undefined ではない) であることを確認
      expect(updateStatusCall[2]).toBeDefined();
    });

    it("test_submitExam_updateStatus_failure_rolls_back_exam_update", async () => {
      // updateStatus が tx 内で throw すると Prisma $transaction が reject され、
      // exam.update / answer.createMany も実質的にロールバックされる。
      // 単体テストでは Prisma の rollback 自体は検証できないため、
      // throw が $transaction の外に伝播することを確認する。
      arrangeOwnedInProgressExam(new Date(), 2);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      const q2 = makeQuestion("q-2", subject2.id, 1);
      arrangeQuestions([q1, q2]);
      mockUserManagementService.getUserById.mockResolvedValue({
        id: userId,
        status: UserStatus.ACTIVE,
      } as never);
      mockExamRepo.update.mockResolvedValue({} as never);
      mockUserManagementService.updateStatus.mockRejectedValue(new Error("DB connection lost"));

      await expect(
        service.submitExam(userId, examId, [
          { questionId: "q-1", selectedIndex: 0 },
          { questionId: "q-2", selectedIndex: 1 },
        ])
      ).rejects.toThrow("DB connection lost");
    });

    it("test_submitExam_failing_does_not_transition_user", async () => {
      arrangeOwnedInProgressExam(new Date(), 2);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      const q2 = makeQuestion("q-2", subject2.id, 1);
      arrangeQuestions([q1, q2]);
      mockExamRepo.update.mockResolvedValue({} as never);

      await service.submitExam(userId, examId, [
        { questionId: "q-1", selectedIndex: 2 }, // wrong
        { questionId: "q-2", selectedIndex: 2 }, // wrong
      ]);

      expect(mockUserManagementService.updateStatus).not.toHaveBeenCalled();
    });

    it("test_submitExam_failing_returns_score_zero_when_all_wrong", async () => {
      arrangeOwnedInProgressExam(new Date(), 2);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      const q2 = makeQuestion("q-2", subject2.id, 1);
      arrangeQuestions([q1, q2]);
      mockExamRepo.update.mockImplementation(async (_id, input) => ({
        id: examId,
        userId,
        startedAt: new Date(),
        endedAt: input.endedAt ?? null,
        score: input.score ?? null,
        totalQuestions: 2,
        questionIds: [],
        passed: input.passed ?? null,
        status: input.status ?? ExamStatus.IN_PROGRESS,
        createdAt: new Date(),
      }));

      const result = await service.submitExam(userId, examId, [
        { questionId: "q-1", selectedIndex: 2 },
        { questionId: "q-2", selectedIndex: 2 },
      ]);

      expect(result.score).toBe(0);
    });

    it("test_submitExam_failing_status_is_FAILED", async () => {
      arrangeOwnedInProgressExam(new Date(), 2, ["q-1"]);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      arrangeQuestions([q1]);
      mockExamRepo.update.mockResolvedValue({} as never);

      await service.submitExam(userId, examId, [{ questionId: "q-1", selectedIndex: 2 }]);

      const updateArgs = mockExamRepo.update.mock.calls[0][1];
      expect(updateArgs.status).toBe(ExamStatus.FAILED);
    });

    it("test_submitExam_persists_answer_records", async () => {
      arrangeOwnedInProgressExam(new Date(), 2);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      const q2 = makeQuestion("q-2", subject2.id, 1);
      arrangeQuestions([q1, q2]);
      mockExamRepo.update.mockResolvedValue({} as never);

      await service.submitExam(userId, examId, [
        { questionId: "q-1", selectedIndex: 0 },
        { questionId: "q-2", selectedIndex: 0 },
      ]);

      expect(mockAnswerRepo.createMany).toHaveBeenCalledWith(
        [
          { examId, questionId: "q-1", selectedIndex: 0, isCorrect: true },
          { examId, questionId: "q-2", selectedIndex: 0, isCorrect: false },
        ],
        expect.anything()
      );
    });

    it("test_submitExam_time_exceeded_returns_score_zero", async () => {
      const expiredStartedAt = new Date(Date.now() - (EXAM_DURATION_MINUTES + 1) * 60 * 1000);
      arrangeOwnedInProgressExam(expiredStartedAt, 1, ["q-1"]);
      const q1 = makeQuestion("q-1", subject1.id, 0);
      arrangeQuestions([q1]);
      mockExamRepo.update.mockImplementation(async (_id, input) => ({
        id: examId,
        userId,
        startedAt: expiredStartedAt,
        endedAt: input.endedAt ?? null,
        score: input.score ?? null,
        totalQuestions: 1,
        questionIds: [],
        passed: input.passed ?? null,
        status: input.status ?? ExamStatus.IN_PROGRESS,
        createdAt: expiredStartedAt,
      }));

      const result = await service.submitExam(userId, examId, [
        { questionId: "q-1", selectedIndex: 0 },
      ]);

      expect(result.score).toBe(0);
    });

    it("test_submitExam_passes_at_threshold", async () => {
      const qs = Array.from({ length: 10 }, (_, i) => makeQuestion(`q-${i}`, subject1.id, 0));
      arrangeOwnedInProgressExam(
        new Date(),
        10,
        qs.map((q) => q.id)
      );
      arrangeQuestions(qs);
      mockUserManagementService.getUserById.mockResolvedValue({
        id: userId,
        status: UserStatus.ACTIVE,
      } as never);
      mockExamRepo.update.mockImplementation(async (_id, input) => ({
        id: examId,
        userId,
        startedAt: new Date(),
        endedAt: input.endedAt ?? null,
        score: input.score ?? null,
        totalQuestions: 10,
        questionIds: [],
        passed: input.passed ?? null,
        status: input.status ?? ExamStatus.IN_PROGRESS,
        createdAt: new Date(),
      }));

      // 8/10 = 80% pass
      const answers = qs.map((q, i) => ({
        questionId: q.id,
        selectedIndex: i < 8 ? 0 : 2,
      }));

      const result = await service.submitExam(userId, examId, answers);

      expect(result.score).toBeGreaterThanOrEqual(PASSING_SCORE_THRESHOLD);
    });
  });

  describe("getExam", () => {
    it("test_getExam_not_found_throws_NotFoundError", async () => {
      mockExamRepo.findById.mockResolvedValue(null);

      await expect(service.getExam("exam-x", "user-1")).rejects.toThrow(NotFoundError);
    });

    it("test_getExam_other_user_throws_BusinessError", async () => {
      mockExamRepo.findById.mockResolvedValue({
        id: "exam-1",
        userId: "other",
      } as never);

      await expect(service.getExam("exam-1", "user-1")).rejects.toThrow(BusinessError);
    });

    it("test_getExam_owned_returns_exam_with_answers", async () => {
      mockExamRepo.findById.mockResolvedValue({
        id: "exam-1",
        userId: "user-1",
        status: ExamStatus.PASSED,
      } as never);
      mockAnswerRepo.findByExamId.mockResolvedValue([]);

      const result = await service.getExam("exam-1", "user-1");

      expect(result.exam.id).toBe("exam-1");
    });
  });

  describe("listAllResults", () => {
    it("test_listAllResults_returns_repo_result", async () => {
      const items = [{ id: "exam-1", userId: "user-1" }] as never;
      mockExamRepo.findAllWithUser.mockResolvedValue(items);

      const result = await service.listAllResults();

      expect(result).toEqual(items);
    });
  });

  describe("listResultsByUser", () => {
    it("test_listResultsByUser_returns_repo_result", async () => {
      const items = [{ id: "exam-1" }] as never;
      mockExamRepo.findByUserOrderByStartedAtDesc.mockResolvedValue(items);

      const result = await service.listResultsByUser("user-1");

      expect(result).toEqual(items);
    });
  });
});
