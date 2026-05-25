import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IJudgmentRecordRepository } from "@/repositories/judgmentRecordRepository";
import type { IFraudFlagRepository } from "@/repositories/fraudFlagRepository";
import { UserStatus, CourseType, JudgmentResult, UserRole, FraudFlagType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

// emailService をモック (setupService.test.ts と同じパターン)
vi.mock("@/services/emailService", () => ({
  sendJudgmentRejectedEmail: vi.fn(),
}));

// db.ts も mock しないと examService 系の $transaction を内部利用する可能性
vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({} as never)),
  }),
}));

import * as emailServiceModule from "@/services/emailService";
import { JudgmentService } from "@/services/judgmentService";
import type {
  ProgressServiceLikeForJudgment,
  UserManagementServiceLikeForJudgment,
} from "@/services/judgmentService";

describe("JudgmentService", () => {
  let service: JudgmentService;
  let mockJudgmentRepo: IJudgmentRecordRepository;
  let mockFraudFlagRepo: IFraudFlagRepository;
  let mockProgressService: ProgressServiceLikeForJudgment;
  let mockUserManagementService: UserManagementServiceLikeForJudgment;

  const userId = "user-1";
  const judgedBy = "管理者A";

  const examPassedUser = {
    id: userId,
    email: "student@example.com",
    name: "山田 花子",
    role: UserRole.STUDENT,
    status: UserStatus.EXAM_PASSED,
    courseType: CourseType.BEGINNER,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const activeUser = {
    ...examPassedUser,
    status: UserStatus.ACTIVE,
  };

  const acceptedRecord = {
    id: "j-1",
    userId,
    result: JudgmentResult.ACCEPTED,
    comment: null,
    judgedBy,
    judgedAt: new Date(),
  };

  const rejectedRecord = {
    ...acceptedRecord,
    id: "j-2",
    result: JudgmentResult.REJECTED,
  };

  beforeEach(() => {
    mockJudgmentRepo = {
      create: vi.fn(),
      findByUser: vi.fn(),
      findLatestByUser: vi.fn(),
    };
    mockFraudFlagRepo = {
      create: vi.fn(),
      findByUser: vi.fn(),
    } as unknown as IFraudFlagRepository;
    mockProgressService = {
      getProgressByUser: vi.fn(),
    };
    mockUserManagementService = {
      getUserById: vi.fn(),
      updateStatus: vi.fn(),
    };

    vi.mocked(emailServiceModule.sendJudgmentRejectedEmail).mockReset();
    service = new JudgmentService(
      mockJudgmentRepo,
      mockFraudFlagRepo,
      mockProgressService,
      mockUserManagementService
    );
  });

  describe("getReviewData", () => {
    it("test_getReviewData_returns_user", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockProgressService.getProgressByUser).mockResolvedValue([]);
      vi.mocked(mockFraudFlagRepo.findByUser).mockResolvedValue([]);
      vi.mocked(mockJudgmentRepo.findByUser).mockResolvedValue([]);

      // Act
      const result = await service.getReviewData(userId);

      // Assert
      expect(result.user).toEqual(examPassedUser);
    });

    it("test_getReviewData_returns_canJudge_true_for_exam_passed", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockProgressService.getProgressByUser).mockResolvedValue([]);
      vi.mocked(mockFraudFlagRepo.findByUser).mockResolvedValue([]);
      vi.mocked(mockJudgmentRepo.findByUser).mockResolvedValue([]);

      // Act
      const result = await service.getReviewData(userId);

      // Assert
      expect(result.canJudge).toBe(true);
    });

    it("test_getReviewData_returns_canJudge_false_for_active", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(activeUser);
      vi.mocked(mockProgressService.getProgressByUser).mockResolvedValue([]);
      vi.mocked(mockFraudFlagRepo.findByUser).mockResolvedValue([]);
      vi.mocked(mockJudgmentRepo.findByUser).mockResolvedValue([]);

      // Act
      const result = await service.getReviewData(userId);

      // Assert
      expect(result.canJudge).toBe(false);
    });

    it("test_getReviewData_includes_progress_for_user_with_courseType", async () => {
      // Arrange
      const progress = [
        {
          subjectId: "s-1",
          subjectName: "教則編",
          totalWatchedMinutes: 100,
          requiredMinutes: 60,
          isFulfilled: true,
        },
      ];
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockProgressService.getProgressByUser).mockResolvedValue(progress);
      vi.mocked(mockFraudFlagRepo.findByUser).mockResolvedValue([]);
      vi.mocked(mockJudgmentRepo.findByUser).mockResolvedValue([]);

      // Act
      const result = await service.getReviewData(userId);

      // Assert
      expect(result.progress).toEqual(progress);
    });

    it("test_getReviewData_returns_empty_progress_for_user_without_courseType", async () => {
      // Arrange
      const userWithoutCourse = { ...examPassedUser, courseType: null };
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(userWithoutCourse);
      vi.mocked(mockFraudFlagRepo.findByUser).mockResolvedValue([]);
      vi.mocked(mockJudgmentRepo.findByUser).mockResolvedValue([]);

      // Act
      const result = await service.getReviewData(userId);

      // Assert
      expect(result.progress).toEqual([]);
    });

    it("test_getReviewData_does_not_call_progressService_when_no_courseType", async () => {
      // Arrange
      const userWithoutCourse = { ...examPassedUser, courseType: null };
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(userWithoutCourse);
      vi.mocked(mockFraudFlagRepo.findByUser).mockResolvedValue([]);
      vi.mocked(mockJudgmentRepo.findByUser).mockResolvedValue([]);

      // Act
      await service.getReviewData(userId);

      // Assert
      expect(mockProgressService.getProgressByUser).not.toHaveBeenCalled();
    });

    it("test_getReviewData_includes_fraud_flags", async () => {
      // Arrange
      const flags = [
        {
          id: "f-1",
          userId,
          type: FraudFlagType.TAB_LEAVE,
          description: "60s",
          detectedAt: new Date(),
          resolvedAt: null,
        },
      ];
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockProgressService.getProgressByUser).mockResolvedValue([]);
      vi.mocked(mockFraudFlagRepo.findByUser).mockResolvedValue(flags);
      vi.mocked(mockJudgmentRepo.findByUser).mockResolvedValue([]);

      // Act
      const result = await service.getReviewData(userId);

      // Assert
      expect(result.fraudFlags).toEqual(flags);
    });

    it("test_getReviewData_includes_judgment_history", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockProgressService.getProgressByUser).mockResolvedValue([]);
      vi.mocked(mockFraudFlagRepo.findByUser).mockResolvedValue([]);
      vi.mocked(mockJudgmentRepo.findByUser).mockResolvedValue([acceptedRecord, rejectedRecord]);

      // Act
      const result = await service.getReviewData(userId);

      // Assert
      expect(result.judgmentHistory).toEqual([acceptedRecord, rejectedRecord]);
    });

    it("test_getReviewData_nonexistent_user_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getReviewData("user-x")).rejects.toThrow(BusinessError);
    });
  });

  describe("judgeAccepted", () => {
    it("test_judgeAccepted_creates_record_with_ACCEPTED", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(acceptedRecord);
      vi.mocked(mockUserManagementService.updateStatus).mockResolvedValue(examPassedUser);

      // Act
      const result = await service.judgeAccepted(userId, judgedBy);

      // Assert
      expect(result).toEqual(acceptedRecord);
    });

    it("test_judgeAccepted_calls_repo_create_with_ACCEPTED", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(acceptedRecord);
      vi.mocked(mockUserManagementService.updateStatus).mockResolvedValue(examPassedUser);

      // Act
      await service.judgeAccepted(userId, judgedBy, "全科目充足");

      // Assert
      expect(mockJudgmentRepo.create).toHaveBeenCalledWith(
        {
          userId,
          result: JudgmentResult.ACCEPTED,
          judgedBy,
          comment: "全科目充足",
        },
        expect.anything()
      );
    });

    it("test_judgeAccepted_calls_updateStatus_to_COMPLETED", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(acceptedRecord);
      vi.mocked(mockUserManagementService.updateStatus).mockResolvedValue(examPassedUser);

      // Act
      await service.judgeAccepted(userId, judgedBy);

      // Assert
      expect(mockUserManagementService.updateStatus).toHaveBeenCalledWith(
        userId,
        UserStatus.COMPLETED,
        expect.anything()
      );
    });

    it("test_judgeAccepted_non_exam_passed_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(activeUser);

      // Act & Assert
      await expect(service.judgeAccepted(userId, judgedBy)).rejects.toThrow(BusinessError);
    });

    it("test_judgeAccepted_non_exam_passed_does_not_call_create", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(activeUser);

      // Act
      await expect(service.judgeAccepted(userId, judgedBy)).rejects.toThrow(BusinessError);

      // Assert
      expect(mockJudgmentRepo.create).not.toHaveBeenCalled();
    });

    it("test_judgeAccepted_nonexistent_user_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.judgeAccepted("user-x", judgedBy)).rejects.toThrow(BusinessError);
    });

    it("test_judgeAccepted_empty_judgedBy_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);

      // Act & Assert
      await expect(service.judgeAccepted(userId, "")).rejects.toThrow(BusinessError);
    });

    it("test_judgeAccepted_whitespace_judgedBy_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);

      // Act & Assert
      await expect(service.judgeAccepted(userId, "   ")).rejects.toThrow(BusinessError);
    });

    // race condition の回帰テスト:
    // tx 外の status check を通過した後 (= getUserById 時点では EXAM_PASSED) に、
    // tx 内の updateStatus が「他の管理者が既に状態を遷移させていた」ことを検知して
    // InvalidTransitionError (BusinessError 派生) を投げるシナリオ。
    // この場合 tx 全体が rollback され、judgmentRepo.create も巻き戻ることを期待する。
    it("test_judgeAccepted_propagates_updateStatus_BusinessError_for_race_condition", async () => {
      // Arrange: status check は EXAM_PASSED で通過
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(acceptedRecord);
      // tx 内の updateStatus が InvalidTransitionError 相当の BusinessError を throw
      vi.mocked(mockUserManagementService.updateStatus).mockRejectedValue(
        new BusinessError("無効なステータス遷移です: COMPLETED → COMPLETED")
      );

      // Act & Assert: BusinessError として伝播する (500 ではなく 400 で返せる)
      await expect(service.judgeAccepted(userId, judgedBy)).rejects.toThrow(BusinessError);
    });
  });

  describe("judgeRejected", () => {
    it("test_judgeRejected_creates_record_with_REJECTED", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(rejectedRecord);
      vi.mocked(emailServiceModule.sendJudgmentRejectedEmail).mockResolvedValue(undefined);

      // Act
      const result = await service.judgeRejected(userId, judgedBy);

      // Assert
      expect(result.record).toEqual(rejectedRecord);
    });

    it("test_judgeRejected_returns_mailSent_true_on_success", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(rejectedRecord);
      vi.mocked(emailServiceModule.sendJudgmentRejectedEmail).mockResolvedValue(undefined);

      // Act
      const result = await service.judgeRejected(userId, judgedBy);

      // Assert
      expect(result.mailSent).toBe(true);
    });

    it("test_judgeRejected_calls_repo_create_with_REJECTED", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(rejectedRecord);
      vi.mocked(emailServiceModule.sendJudgmentRejectedEmail).mockResolvedValue(undefined);

      // Act
      await service.judgeRejected(userId, judgedBy);

      // Assert
      expect(mockJudgmentRepo.create).toHaveBeenCalledWith({
        userId,
        result: JudgmentResult.REJECTED,
        judgedBy,
        comment: undefined,
      });
    });

    it("test_judgeRejected_sends_email_to_user", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(rejectedRecord);
      vi.mocked(emailServiceModule.sendJudgmentRejectedEmail).mockResolvedValue(undefined);

      // Act
      await service.judgeRejected(userId, judgedBy);

      // Assert
      expect(emailServiceModule.sendJudgmentRejectedEmail).toHaveBeenCalledWith({
        to: examPassedUser.email,
        studentName: examPassedUser.name,
      });
    });

    it("test_judgeRejected_does_not_call_updateStatus", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(rejectedRecord);
      vi.mocked(emailServiceModule.sendJudgmentRejectedEmail).mockResolvedValue(undefined);

      // Act
      await service.judgeRejected(userId, judgedBy);

      // Assert
      expect(mockUserManagementService.updateStatus).not.toHaveBeenCalled();
    });

    it("test_judgeRejected_email_failure_still_returns_record", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(rejectedRecord);
      vi.mocked(emailServiceModule.sendJudgmentRejectedEmail).mockRejectedValue(
        new Error("Service unavailable")
      );

      // Act
      const result = await service.judgeRejected(userId, judgedBy);

      // Assert
      expect(result.record).toEqual(rejectedRecord);
    });

    it("test_judgeRejected_email_failure_returns_mailSent_false", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockJudgmentRepo.create).mockResolvedValue(rejectedRecord);
      vi.mocked(emailServiceModule.sendJudgmentRejectedEmail).mockRejectedValue(
        new Error("Service unavailable")
      );

      // Act
      const result = await service.judgeRejected(userId, judgedBy);

      // Assert
      expect(result.mailSent).toBe(false);
    });

    it("test_judgeRejected_non_exam_passed_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(activeUser);

      // Act & Assert
      await expect(service.judgeRejected(userId, judgedBy)).rejects.toThrow(BusinessError);
    });

    it("test_judgeRejected_non_exam_passed_does_not_call_create", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(activeUser);

      // Act
      await expect(service.judgeRejected(userId, judgedBy)).rejects.toThrow(BusinessError);

      // Assert
      expect(mockJudgmentRepo.create).not.toHaveBeenCalled();
    });

    it("test_judgeRejected_empty_judgedBy_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);

      // Act & Assert
      await expect(service.judgeRejected(userId, "")).rejects.toThrow(BusinessError);
    });
  });
});
