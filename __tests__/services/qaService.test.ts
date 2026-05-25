import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IQARecordRepository } from "@/repositories/qaRecordRepository";
import type { IUserRepository } from "@/repositories/userRepository";
import { BusinessError, NotFoundError } from "@/services/errors";

// emailService をモック (setupService.test.ts と同じパターン)
vi.mock("@/services/emailService", () => ({
  sendAnswerNotificationEmail: vi.fn(),
}));

import * as emailServiceModule from "@/services/emailService";
import { QAService } from "@/services/qaService";

describe("QAService", () => {
  let service: QAService;
  let mockQARepo: IQARecordRepository;
  let mockUserRepo: IUserRepository;

  const userId = "user-1";
  const qaId = "qa-1";

  const mockUser = {
    id: userId,
    email: "student@example.com",
    name: "山田 花子",
    passwordHash: "hash",
    role: "STUDENT" as const,
    status: "ACTIVE" as const,
    courseType: "BEGINNER" as const,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const unansweredRecord = {
    id: qaId,
    userId,
    question: "受講中に不明点があったらどうすればよいですか？",
    answer: null,
    questionedAt: new Date("2026-05-25T00:00:00Z"),
    answeredAt: null,
    answeredBy: null,
  };

  const answeredRecord = {
    ...unansweredRecord,
    answer: "本フォームから何度でも質問してください。",
    answeredAt: new Date("2026-05-25T01:00:00Z"),
    answeredBy: "管理者A",
  };

  beforeEach(() => {
    mockQARepo = {
      findById: vi.fn(),
      findByUser: vi.fn(),
      findAllWithUser: vi.fn(),
      create: vi.fn(),
      updateAnswer: vi.fn(),
    };
    mockUserRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      updatePassword: vi.fn(),
    } as unknown as IUserRepository;

    vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockReset();
    service = new QAService(mockQARepo, mockUserRepo);
  });

  describe("createQuestion", () => {
    it("test_createQuestion_valid_returns_record", async () => {
      // Arrange
      vi.mocked(mockQARepo.create).mockResolvedValue(unansweredRecord);

      // Act
      const result = await service.createQuestion(
        userId,
        "受講中に不明点があったらどうすればよいですか？"
      );

      // Assert
      expect(result).toEqual(unansweredRecord);
    });

    it("test_createQuestion_valid_calls_repo_with_userId_and_question", async () => {
      // Arrange
      vi.mocked(mockQARepo.create).mockResolvedValue(unansweredRecord);

      // Act
      await service.createQuestion(userId, "受講中に不明点があったらどうすればよいですか？");

      // Assert
      expect(mockQARepo.create).toHaveBeenCalledWith({
        userId,
        question: "受講中に不明点があったらどうすればよいですか？",
      });
    });

    it("test_createQuestion_empty_question_throws_BusinessError", async () => {
      // Act & Assert
      await expect(service.createQuestion(userId, "")).rejects.toThrow(BusinessError);
    });

    it("test_createQuestion_empty_question_does_not_call_repo", async () => {
      // Act
      await expect(service.createQuestion(userId, "")).rejects.toThrow(BusinessError);

      // Assert
      expect(mockQARepo.create).not.toHaveBeenCalled();
    });

    it("test_createQuestion_whitespace_only_throws_BusinessError", async () => {
      // Act & Assert
      await expect(service.createQuestion(userId, "   \n  ")).rejects.toThrow(BusinessError);
    });

    it("test_createQuestion_whitespace_only_does_not_call_repo", async () => {
      // Act
      await expect(service.createQuestion(userId, "   \n  ")).rejects.toThrow(BusinessError);

      // Assert
      expect(mockQARepo.create).not.toHaveBeenCalled();
    });

    it("test_createQuestion_too_long_throws_BusinessError", async () => {
      // Arrange
      const longQuestion = "あ".repeat(2001);

      // Act & Assert
      await expect(service.createQuestion(userId, longQuestion)).rejects.toThrow(BusinessError);
    });

    it("test_createQuestion_too_long_does_not_call_repo", async () => {
      // Arrange
      const longQuestion = "あ".repeat(2001);

      // Act
      await expect(service.createQuestion(userId, longQuestion)).rejects.toThrow(BusinessError);

      // Assert
      expect(mockQARepo.create).not.toHaveBeenCalled();
    });

    it("test_createQuestion_trims_leading_trailing_whitespace", async () => {
      // Arrange
      vi.mocked(mockQARepo.create).mockResolvedValue(unansweredRecord);

      // Act
      await service.createQuestion(userId, "  質問本文  ");

      // Assert
      expect(mockQARepo.create).toHaveBeenCalledWith({
        userId,
        question: "質問本文",
      });
    });
  });

  describe("answerQuestion", () => {
    // 新規回答のシナリオの共通 Arrange を関数化
    const arrangeNewAnswerScenario = () => {
      vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
      vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockResolvedValue(undefined);
    };

    describe("新規回答 (initial answer)", () => {
      it("test_answerQuestion_new_answer_returns_record", async () => {
        // Arrange
        arrangeNewAnswerScenario();

        // Act
        const result = await service.answerQuestion(
          qaId,
          "本フォームから何度でも質問してください。",
          "管理者A"
        );

        // Assert
        expect(result.record).toEqual(answeredRecord);
      });

      it("test_answerQuestion_new_answer_returns_mailSent_true", async () => {
        // Arrange
        arrangeNewAnswerScenario();

        // Act
        const result = await service.answerQuestion(
          qaId,
          "本フォームから何度でも質問してください。",
          "管理者A"
        );

        // Assert
        expect(result.mailSent).toBe(true);
      });

      it("test_answerQuestion_new_answer_calls_updateAnswer_with_answer_fields", async () => {
        // Arrange
        arrangeNewAnswerScenario();

        // Act
        await service.answerQuestion(qaId, "本フォームから何度でも質問してください。", "管理者A");

        // Assert
        expect(mockQARepo.updateAnswer).toHaveBeenCalledWith(
          qaId,
          expect.objectContaining({
            answer: "本フォームから何度でも質問してください。",
            answeredBy: "管理者A",
            answeredAt: expect.any(Date),
          })
        );
      });

      it("test_answerQuestion_new_answer_sends_notification_email_with_user_data", async () => {
        // Arrange
        arrangeNewAnswerScenario();

        // Act
        await service.answerQuestion(qaId, "本フォームから何度でも質問してください。", "管理者A");

        // Assert
        expect(emailServiceModule.sendAnswerNotificationEmail).toHaveBeenCalledWith({
          to: "student@example.com",
          studentName: "山田 花子",
          question: unansweredRecord.question,
          answer: "本フォームから何度でも質問してください。",
        });
      });
    });

    describe("回答修正 (revision)", () => {
      const revisedRecord = {
        ...answeredRecord,
        answer: "修正後の回答",
        answeredBy: "管理者B",
      };

      const arrangeRevisionScenario = () => {
        vi.mocked(mockQARepo.findById).mockResolvedValue(answeredRecord);
        vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(revisedRecord);
        vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
        vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockResolvedValue(undefined);
      };

      it("test_answerQuestion_revision_returns_updated_record", async () => {
        // Arrange
        arrangeRevisionScenario();

        // Act
        const result = await service.answerQuestion(qaId, "修正後の回答", "管理者B");

        // Assert
        expect(result.record).toEqual(revisedRecord);
      });

      it("test_answerQuestion_revision_returns_mailSent_true", async () => {
        // Arrange
        arrangeRevisionScenario();

        // Act
        const result = await service.answerQuestion(qaId, "修正後の回答", "管理者B");

        // Assert
        expect(result.mailSent).toBe(true);
      });

      it("test_answerQuestion_revision_overwrites_with_new_answeredBy", async () => {
        // Arrange
        arrangeRevisionScenario();

        // Act
        await service.answerQuestion(qaId, "修正後の回答", "管理者B");

        // Assert
        expect(mockQARepo.updateAnswer).toHaveBeenCalledWith(
          qaId,
          expect.objectContaining({
            answer: "修正後の回答",
            answeredBy: "管理者B",
          })
        );
      });
    });

    describe("バリデーション", () => {
      it("test_answerQuestion_empty_answer_throws_BusinessError", async () => {
        await expect(service.answerQuestion(qaId, "", "管理者A")).rejects.toThrow(BusinessError);
      });

      it("test_answerQuestion_empty_answer_does_not_call_updateAnswer", async () => {
        await expect(service.answerQuestion(qaId, "", "管理者A")).rejects.toThrow(BusinessError);

        expect(mockQARepo.updateAnswer).not.toHaveBeenCalled();
      });

      it("test_answerQuestion_whitespace_only_answer_throws_BusinessError", async () => {
        await expect(service.answerQuestion(qaId, "  \n ", "管理者A")).rejects.toThrow(
          BusinessError
        );
      });

      it("test_answerQuestion_whitespace_only_answer_does_not_call_updateAnswer", async () => {
        await expect(service.answerQuestion(qaId, "  \n ", "管理者A")).rejects.toThrow(
          BusinessError
        );

        expect(mockQARepo.updateAnswer).not.toHaveBeenCalled();
      });

      it("test_answerQuestion_too_long_throws_BusinessError", async () => {
        const longAnswer = "あ".repeat(2001);

        await expect(service.answerQuestion(qaId, longAnswer, "管理者A")).rejects.toThrow(
          BusinessError
        );
      });

      it("test_answerQuestion_too_long_does_not_call_updateAnswer", async () => {
        const longAnswer = "あ".repeat(2001);

        await expect(service.answerQuestion(qaId, longAnswer, "管理者A")).rejects.toThrow(
          BusinessError
        );

        expect(mockQARepo.updateAnswer).not.toHaveBeenCalled();
      });

      it("test_answerQuestion_empty_answeredBy_throws_BusinessError", async () => {
        await expect(service.answerQuestion(qaId, "回答", "")).rejects.toThrow(BusinessError);
      });

      it("test_answerQuestion_whitespace_only_answeredBy_throws_BusinessError", async () => {
        await expect(service.answerQuestion(qaId, "回答", "   ")).rejects.toThrow(BusinessError);
      });

      it("test_answerQuestion_invalid_answeredBy_does_not_call_updateAnswer", async () => {
        await expect(service.answerQuestion(qaId, "回答", "")).rejects.toThrow(BusinessError);

        expect(mockQARepo.updateAnswer).not.toHaveBeenCalled();
      });

      it("test_answerQuestion_nonexistent_qa_throws_NotFoundError", async () => {
        vi.mocked(mockQARepo.findById).mockResolvedValue(null);

        await expect(service.answerQuestion("qa-x", "回答", "管理者A")).rejects.toThrow(
          NotFoundError
        );
      });

      it("test_answerQuestion_nonexistent_qa_does_not_call_updateAnswer", async () => {
        vi.mocked(mockQARepo.findById).mockResolvedValue(null);

        await expect(service.answerQuestion("qa-x", "回答", "管理者A")).rejects.toThrow(
          NotFoundError
        );

        expect(mockQARepo.updateAnswer).not.toHaveBeenCalled();
      });
    });

    describe("メール送信失敗", () => {
      const arrangeEmailFailureScenario = () => {
        vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
        vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
        vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
        vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockRejectedValue(
          new Error("Service unavailable")
        );
      };

      it("test_answerQuestion_email_failure_still_returns_record", async () => {
        // Arrange
        arrangeEmailFailureScenario();

        // Act
        const result = await service.answerQuestion(qaId, "回答です", "管理者A");

        // Assert
        expect(result.record).toEqual(answeredRecord);
      });

      it("test_answerQuestion_email_failure_returns_mailSent_false", async () => {
        // Arrange
        arrangeEmailFailureScenario();

        // Act
        const result = await service.answerQuestion(qaId, "回答です", "管理者A");

        // Assert
        expect(result.mailSent).toBe(false);
      });
    });

    describe("ユーザー不在", () => {
      const arrangeUserNotFoundScenario = () => {
        vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
        vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
        vi.mocked(mockUserRepo.findById).mockResolvedValue(null);
      };

      it("test_answerQuestion_user_not_found_returns_record", async () => {
        // Arrange
        arrangeUserNotFoundScenario();

        // Act
        const result = await service.answerQuestion(qaId, "回答です", "管理者A");

        // Assert
        expect(result.record).toEqual(answeredRecord);
      });

      it("test_answerQuestion_user_not_found_returns_mailSent_false", async () => {
        // Arrange
        arrangeUserNotFoundScenario();

        // Act
        const result = await service.answerQuestion(qaId, "回答です", "管理者A");

        // Assert
        expect(result.mailSent).toBe(false);
      });

      it("test_answerQuestion_user_not_found_does_not_send_email", async () => {
        // Arrange
        arrangeUserNotFoundScenario();

        // Act
        await service.answerQuestion(qaId, "回答です", "管理者A");

        // Assert
        expect(emailServiceModule.sendAnswerNotificationEmail).not.toHaveBeenCalled();
      });
    });

    it("test_answerQuestion_trims_answer_whitespace", async () => {
      // Arrange
      vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
      vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockResolvedValue(undefined);

      // Act
      await service.answerQuestion(qaId, "  回答  ", "管理者A");

      // Assert
      expect(mockQARepo.updateAnswer).toHaveBeenCalledWith(
        qaId,
        expect.objectContaining({ answer: "回答" })
      );
    });

    it("test_answerQuestion_trims_answeredBy_whitespace", async () => {
      // Arrange
      vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
      vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockResolvedValue(undefined);

      // Act
      await service.answerQuestion(qaId, "回答", "  管理者A  ");

      // Assert
      expect(mockQARepo.updateAnswer).toHaveBeenCalledWith(
        qaId,
        expect.objectContaining({ answeredBy: "管理者A" })
      );
    });
  });

  describe("listByUser", () => {
    it("test_listByUser_returns_records", async () => {
      // Arrange
      vi.mocked(mockQARepo.findByUser).mockResolvedValue([answeredRecord, unansweredRecord]);

      // Act
      const result = await service.listByUser(userId);

      // Assert
      expect(result).toEqual([answeredRecord, unansweredRecord]);
    });

    it("test_listByUser_calls_repo_with_userId", async () => {
      // Arrange
      vi.mocked(mockQARepo.findByUser).mockResolvedValue([]);

      // Act
      await service.listByUser(userId);

      // Assert
      expect(mockQARepo.findByUser).toHaveBeenCalledWith(userId);
    });

    it("test_listByUser_empty_returns_empty_array", async () => {
      // Arrange
      vi.mocked(mockQARepo.findByUser).mockResolvedValue([]);

      // Act
      const result = await service.listByUser(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("listAll", () => {
    const withUser = {
      ...unansweredRecord,
      user: { id: userId, name: "山田 花子", email: "student@example.com" },
    };

    it("test_listAll_no_filter_returns_records", async () => {
      // Arrange
      vi.mocked(mockQARepo.findAllWithUser).mockResolvedValue([withUser]);

      // Act
      const result = await service.listAll();

      // Assert
      expect(result).toEqual([withUser]);
    });

    it("test_listAll_no_filter_calls_repo_with_unansweredOnly_false", async () => {
      // Arrange
      vi.mocked(mockQARepo.findAllWithUser).mockResolvedValue([]);

      // Act
      await service.listAll();

      // Assert
      expect(mockQARepo.findAllWithUser).toHaveBeenCalledWith({ unansweredOnly: false });
    });

    it("test_listAll_unansweredOnly_true_passes_filter", async () => {
      // Arrange
      vi.mocked(mockQARepo.findAllWithUser).mockResolvedValue([]);

      // Act
      await service.listAll(true);

      // Assert
      expect(mockQARepo.findAllWithUser).toHaveBeenCalledWith({ unansweredOnly: true });
    });

    it("test_listAll_unansweredOnly_false_passes_filter", async () => {
      // Arrange
      vi.mocked(mockQARepo.findAllWithUser).mockResolvedValue([]);

      // Act
      await service.listAll(false);

      // Assert
      expect(mockQARepo.findAllWithUser).toHaveBeenCalledWith({ unansweredOnly: false });
    });
  });
});
