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
    it("test_createQuestion_valid_creates_record", async () => {
      vi.mocked(mockQARepo.create).mockResolvedValue(unansweredRecord);

      const result = await service.createQuestion(userId, "受講中に不明点があったらどうすればよいですか？");

      expect(result).toEqual(unansweredRecord);
      expect(mockQARepo.create).toHaveBeenCalledWith({
        userId,
        question: "受講中に不明点があったらどうすればよいですか？",
      });
    });

    it("test_createQuestion_empty_question_throws_BusinessError", async () => {
      await expect(service.createQuestion(userId, "")).rejects.toThrow(BusinessError);
      expect(mockQARepo.create).not.toHaveBeenCalled();
    });

    it("test_createQuestion_whitespace_only_throws_BusinessError", async () => {
      await expect(service.createQuestion(userId, "   \n  ")).rejects.toThrow(BusinessError);
      expect(mockQARepo.create).not.toHaveBeenCalled();
    });

    it("test_createQuestion_too_long_throws_BusinessError", async () => {
      const longQuestion = "あ".repeat(2001);

      await expect(service.createQuestion(userId, longQuestion)).rejects.toThrow(BusinessError);
      expect(mockQARepo.create).not.toHaveBeenCalled();
    });

    it("test_createQuestion_trims_leading_trailing_whitespace", async () => {
      vi.mocked(mockQARepo.create).mockResolvedValue(unansweredRecord);

      await service.createQuestion(userId, "  質問本文  ");

      expect(mockQARepo.create).toHaveBeenCalledWith({
        userId,
        question: "質問本文",
      });
    });
  });

  describe("answerQuestion", () => {
    it("test_answerQuestion_new_answer_updates_record_and_sends_email", async () => {
      vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
      vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockResolvedValue(undefined);

      const result = await service.answerQuestion(
        qaId,
        "本フォームから何度でも質問してください。",
        "管理者A"
      );

      expect(result.record).toEqual(answeredRecord);
      expect(result.mailSent).toBe(true);
      expect(mockQARepo.updateAnswer).toHaveBeenCalledWith(
        qaId,
        expect.objectContaining({
          answer: "本フォームから何度でも質問してください。",
          answeredBy: "管理者A",
          answeredAt: expect.any(Date),
        })
      );
      expect(emailServiceModule.sendAnswerNotificationEmail).toHaveBeenCalledWith({
        to: "student@example.com",
        studentName: "山田 花子",
        question: unansweredRecord.question,
        answer: "本フォームから何度でも質問してください。",
      });
    });

    it("test_answerQuestion_revision_overwrites_existing_answer", async () => {
      const revisedRecord = {
        ...answeredRecord,
        answer: "修正後の回答",
        answeredBy: "管理者B",
      };
      vi.mocked(mockQARepo.findById).mockResolvedValue(answeredRecord);
      vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(revisedRecord);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockResolvedValue(undefined);

      const result = await service.answerQuestion(qaId, "修正後の回答", "管理者B");

      expect(result.record).toEqual(revisedRecord);
      expect(result.mailSent).toBe(true);
      expect(mockQARepo.updateAnswer).toHaveBeenCalledWith(
        qaId,
        expect.objectContaining({
          answer: "修正後の回答",
          answeredBy: "管理者B",
        })
      );
    });

    it("test_answerQuestion_empty_answer_throws_BusinessError", async () => {
      await expect(service.answerQuestion(qaId, "", "管理者A")).rejects.toThrow(BusinessError);
      expect(mockQARepo.updateAnswer).not.toHaveBeenCalled();
    });

    it("test_answerQuestion_whitespace_only_answer_throws_BusinessError", async () => {
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
      expect(mockQARepo.updateAnswer).not.toHaveBeenCalled();
    });

    it("test_answerQuestion_nonexistent_qa_throws_NotFoundError", async () => {
      vi.mocked(mockQARepo.findById).mockResolvedValue(null);

      await expect(service.answerQuestion("qa-x", "回答", "管理者A")).rejects.toThrow(
        NotFoundError
      );
      expect(mockQARepo.updateAnswer).not.toHaveBeenCalled();
    });

    it("test_answerQuestion_email_failure_returns_mailSent_false_and_does_not_throw", async () => {
      vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
      vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockRejectedValue(
        new Error("Service unavailable")
      );

      const result = await service.answerQuestion(qaId, "回答です", "管理者A");

      expect(result.record).toEqual(answeredRecord);
      expect(result.mailSent).toBe(false);
    });

    it("test_answerQuestion_user_not_found_returns_mailSent_false", async () => {
      vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
      vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(null);

      const result = await service.answerQuestion(qaId, "回答です", "管理者A");

      expect(result.record).toEqual(answeredRecord);
      expect(result.mailSent).toBe(false);
      expect(emailServiceModule.sendAnswerNotificationEmail).not.toHaveBeenCalled();
    });

    it("test_answerQuestion_trims_whitespace", async () => {
      vi.mocked(mockQARepo.findById).mockResolvedValue(unansweredRecord);
      vi.mocked(mockQARepo.updateAnswer).mockResolvedValue(answeredRecord);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(emailServiceModule.sendAnswerNotificationEmail).mockResolvedValue(undefined);

      await service.answerQuestion(qaId, "  回答  ", "管理者A");

      expect(mockQARepo.updateAnswer).toHaveBeenCalledWith(
        qaId,
        expect.objectContaining({ answer: "回答" })
      );
    });
  });

  describe("listByUser", () => {
    it("test_listByUser_returns_records", async () => {
      vi.mocked(mockQARepo.findByUser).mockResolvedValue([answeredRecord, unansweredRecord]);

      const result = await service.listByUser(userId);

      expect(result).toEqual([answeredRecord, unansweredRecord]);
      expect(mockQARepo.findByUser).toHaveBeenCalledWith(userId);
    });

    it("test_listByUser_empty_returns_empty_array", async () => {
      vi.mocked(mockQARepo.findByUser).mockResolvedValue([]);

      const result = await service.listByUser(userId);

      expect(result).toEqual([]);
    });
  });

  describe("listAll", () => {
    it("test_listAll_no_filter_returns_all_records", async () => {
      const withUser = {
        ...unansweredRecord,
        user: { id: userId, name: "山田 花子", email: "student@example.com" },
      };
      vi.mocked(mockQARepo.findAllWithUser).mockResolvedValue([withUser]);

      const result = await service.listAll();

      expect(result).toEqual([withUser]);
      expect(mockQARepo.findAllWithUser).toHaveBeenCalledWith({ unansweredOnly: false });
    });

    it("test_listAll_unansweredOnly_true_passes_filter", async () => {
      vi.mocked(mockQARepo.findAllWithUser).mockResolvedValue([]);

      await service.listAll(true);

      expect(mockQARepo.findAllWithUser).toHaveBeenCalledWith({ unansweredOnly: true });
    });

    it("test_listAll_unansweredOnly_false_passes_filter", async () => {
      vi.mocked(mockQARepo.findAllWithUser).mockResolvedValue([]);

      await service.listAll(false);

      expect(mockQARepo.findAllWithUser).toHaveBeenCalledWith({ unansweredOnly: false });
    });
  });
});
