import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Resend SDK をモック
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe("emailService", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_API_KEY: "test-api-key",
      RESEND_FROM_ADDRESS: "noreply@example.com",
    };
    mockSend.mockReset();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("sendInviteEmail", () => {
    it("test_sendInviteEmail_valid_params_calls_resend_send", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendInviteEmail } = await import("@/services/emailService");

      // Act
      await sendInviteEmail({
        to: "student@example.com",
        setupUrl: "https://example.com/setup/password?token=abc",
        studentName: "田中 太郎",
      });

      // Assert
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("test_sendInviteEmail_valid_params_sends_to_correct_address", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendInviteEmail } = await import("@/services/emailService");

      // Act
      await sendInviteEmail({
        to: "student@example.com",
        setupUrl: "https://example.com/setup/password?token=abc",
        studentName: "田中 太郎",
      });

      // Assert
      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.to).toBe("student@example.com");
    });

    it("test_sendInviteEmail_valid_params_uses_correct_subject", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendInviteEmail } = await import("@/services/emailService");

      // Act
      await sendInviteEmail({
        to: "student@example.com",
        setupUrl: "https://example.com/setup/password?token=abc",
        studentName: "田中 太郎",
      });

      // Assert
      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toBe("【ドローンスクール】本登録のご案内");
    });

    it("test_sendInviteEmail_valid_params_includes_setup_url_in_body", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendInviteEmail } = await import("@/services/emailService");
      const setupUrl = "https://example.com/setup/password?token=xyz";

      // Act
      await sendInviteEmail({
        to: "student@example.com",
        setupUrl,
        studentName: "田中 太郎",
      });

      // Assert
      const callArgs = mockSend.mock.calls[0][0];
      const body = callArgs.html ?? callArgs.text ?? "";
      expect(body).toContain(setupUrl);
    });

    it("test_sendInviteEmail_valid_params_includes_student_name_in_body", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendInviteEmail } = await import("@/services/emailService");

      // Act
      await sendInviteEmail({
        to: "student@example.com",
        setupUrl: "https://example.com/setup/password?token=abc",
        studentName: "田中 太郎",
      });

      // Assert
      const callArgs = mockSend.mock.calls[0][0];
      const body = callArgs.html ?? callArgs.text ?? "";
      expect(body).toContain("田中 太郎");
    });

    it("test_sendInviteEmail_resend_returns_error_throws", async () => {
      // Arrange
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Invalid API key" },
      });
      const { sendInviteEmail } = await import("@/services/emailService");

      // Act & Assert
      await expect(
        sendInviteEmail({
          to: "student@example.com",
          setupUrl: "https://example.com/setup/password?token=abc",
          studentName: "田中 太郎",
        })
      ).rejects.toThrow();
    });

    it("test_sendInviteEmail_without_api_key_throws_error", async () => {
      // Arrange
      delete process.env.RESEND_API_KEY;

      // Act & Assert
      await expect(async () => {
        const { sendInviteEmail } = await import("@/services/emailService");
        await sendInviteEmail({
          to: "student@example.com",
          setupUrl: "https://example.com/setup",
          studentName: "田中 太郎",
        });
      }).rejects.toThrow();
    });
  });

  describe("sendAnswerNotificationEmail", () => {
    it("test_sendAnswerNotificationEmail_valid_params_calls_resend_send", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      await sendAnswerNotificationEmail({
        to: "student@example.com",
        studentName: "山田 花子",
        question: "受講中に不明点があったらどうすればよいですか？",
        answer: "本フォームから何度でも質問してください。",
      });

      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("test_sendAnswerNotificationEmail_sends_to_correct_address", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      await sendAnswerNotificationEmail({
        to: "student@example.com",
        studentName: "山田 花子",
        question: "Q?",
        answer: "A.",
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.to).toBe("student@example.com");
    });

    it("test_sendAnswerNotificationEmail_uses_correct_subject", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      await sendAnswerNotificationEmail({
        to: "student@example.com",
        studentName: "山田 花子",
        question: "Q?",
        answer: "A.",
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toBe("【ドローンスクール】ご質問への回答をお送りします");
    });

    it("test_sendAnswerNotificationEmail_includes_student_name_in_body", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      // Act
      await sendAnswerNotificationEmail({
        to: "student@example.com",
        studentName: "山田 花子",
        question: "Q?",
        answer: "A.",
      });

      // Assert
      const body = mockSend.mock.calls[0][0].html ?? mockSend.mock.calls[0][0].text ?? "";
      expect(body).toContain("山田 花子");
    });

    it("test_sendAnswerNotificationEmail_includes_question_in_body", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      // Act
      await sendAnswerNotificationEmail({
        to: "student@example.com",
        studentName: "山田 花子",
        question: "受講中に不明点があったらどうすればよいですか？",
        answer: "A.",
      });

      // Assert
      const body = mockSend.mock.calls[0][0].html ?? mockSend.mock.calls[0][0].text ?? "";
      expect(body).toContain("受講中に不明点があったらどうすればよいですか？");
    });

    it("test_sendAnswerNotificationEmail_includes_answer_in_body", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      // Act
      await sendAnswerNotificationEmail({
        to: "student@example.com",
        studentName: "山田 花子",
        question: "Q?",
        answer: "本フォームから何度でも質問してください。",
      });

      // Assert
      const body = mockSend.mock.calls[0][0].html ?? mockSend.mock.calls[0][0].text ?? "";
      expect(body).toContain("本フォームから何度でも質問してください。");
    });

    it("test_sendAnswerNotificationEmail_does_not_contain_raw_script_tag", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      // Act
      await sendAnswerNotificationEmail({
        to: "student@example.com",
        studentName: "山田",
        question: "<script>alert('xss')</script>",
        answer: "A.",
      });

      // Assert
      const body: string = mockSend.mock.calls[0][0].html ?? "";
      expect(body).not.toContain("<script>alert");
    });

    it("test_sendAnswerNotificationEmail_escapes_html_special_chars", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      // Act
      await sendAnswerNotificationEmail({
        to: "student@example.com",
        studentName: "山田",
        question: "<script>alert('xss')</script>",
        answer: "A.",
      });

      // Assert
      const body: string = mockSend.mock.calls[0][0].html ?? "";
      expect(body).toContain("&lt;script&gt;");
    });

    it("test_sendAnswerNotificationEmail_resend_error_throws", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Service unavailable" },
      });
      const { sendAnswerNotificationEmail } = await import("@/services/emailService");

      await expect(
        sendAnswerNotificationEmail({
          to: "student@example.com",
          studentName: "山田",
          question: "Q?",
          answer: "A.",
        })
      ).rejects.toThrow();
    });

    it("test_sendAnswerNotificationEmail_without_api_key_throws_error", async () => {
      delete process.env.RESEND_API_KEY;

      await expect(async () => {
        const { sendAnswerNotificationEmail } = await import("@/services/emailService");
        await sendAnswerNotificationEmail({
          to: "student@example.com",
          studentName: "山田",
          question: "Q?",
          answer: "A.",
        });
      }).rejects.toThrow();
    });
  });

  describe("sendJudgmentRejectedEmail", () => {
    it("test_sendJudgmentRejectedEmail_calls_resend_send", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-3" }, error: null });
      const { sendJudgmentRejectedEmail } = await import("@/services/emailService");

      // Act
      await sendJudgmentRejectedEmail({
        to: "student@example.com",
        studentName: "山田 花子",
      });

      // Assert
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("test_sendJudgmentRejectedEmail_sends_to_correct_address", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-3" }, error: null });
      const { sendJudgmentRejectedEmail } = await import("@/services/emailService");

      // Act
      await sendJudgmentRejectedEmail({
        to: "student@example.com",
        studentName: "山田 花子",
      });

      // Assert
      expect(mockSend.mock.calls[0][0].to).toBe("student@example.com");
    });

    it("test_sendJudgmentRejectedEmail_uses_judgment_subject", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-3" }, error: null });
      const { sendJudgmentRejectedEmail } = await import("@/services/emailService");

      // Act
      await sendJudgmentRejectedEmail({
        to: "student@example.com",
        studentName: "山田 花子",
      });

      // Assert
      expect(mockSend.mock.calls[0][0].subject).toBe(
        "【ドローンスクール】受講確認に関する重要なお知らせ"
      );
    });

    it("test_sendJudgmentRejectedEmail_includes_student_name_in_body", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-3" }, error: null });
      const { sendJudgmentRejectedEmail } = await import("@/services/emailService");

      // Act
      await sendJudgmentRejectedEmail({
        to: "student@example.com",
        studentName: "山田 花子",
      });

      // Assert
      const body = mockSend.mock.calls[0][0].html ?? "";
      expect(body).toContain("山田 花子");
    });

    it("test_sendJudgmentRejectedEmail_escapes_html_in_student_name", async () => {
      // Arrange
      mockSend.mockResolvedValue({ data: { id: "email-3" }, error: null });
      const { sendJudgmentRejectedEmail } = await import("@/services/emailService");

      // Act
      await sendJudgmentRejectedEmail({
        to: "student@example.com",
        studentName: "<script>",
      });

      // Assert
      const body: string = mockSend.mock.calls[0][0].html ?? "";
      expect(body).not.toContain("<script>");
    });

    it("test_sendJudgmentRejectedEmail_resend_error_throws", async () => {
      // Arrange
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Service unavailable" },
      });
      const { sendJudgmentRejectedEmail } = await import("@/services/emailService");

      // Act & Assert
      await expect(
        sendJudgmentRejectedEmail({
          to: "student@example.com",
          studentName: "山田",
        })
      ).rejects.toThrow();
    });

    it("test_sendJudgmentRejectedEmail_without_api_key_throws_error", async () => {
      // Arrange
      delete process.env.RESEND_API_KEY;

      // Act & Assert
      await expect(async () => {
        const { sendJudgmentRejectedEmail } = await import("@/services/emailService");
        await sendJudgmentRejectedEmail({
          to: "student@example.com",
          studentName: "山田",
        });
      }).rejects.toThrow();
    });
  });
});
