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
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "test-api-key" };
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
});
