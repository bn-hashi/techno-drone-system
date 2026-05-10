import { describe, it, expect, beforeEach, vi, Mocked } from "vitest";
import { User } from "@prisma/client";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import type { IUserRepository } from "@/repositories/userRepository";
import type { IAgreementLogRepository } from "@/repositories/agreementLogRepository";

// bcryptjs をモック
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}));

// token をモック
vi.mock("@/lib/token", () => ({
  generateInviteToken: vi.fn(),
  verifyInviteToken: vi.fn(),
}));

// emailService をモック
vi.mock("@/services/emailService", () => ({
  sendInviteEmail: vi.fn(),
}));

import bcrypt from "bcryptjs";
import * as tokenModule from "@/lib/token";
import * as emailServiceModule from "@/services/emailService";
import { SetupService } from "@/services/setupService";
import { BusinessError } from "@/services/errors";

describe("SetupService", () => {
  let service: SetupService;
  let mockUserRepo: Mocked<IUserRepository>;
  let mockAgreementLogRepo: Mocked<IAgreementLogRepository>;

  const mockUser: User = {
    id: "user-1",
    email: "student@example.com",
    name: "田中 太郎",
    passwordHash: "",
    role: UserRole.STUDENT as "STUDENT",
    courseType: CourseType.BEGINNER as "BEGINNER",
    status: UserStatus.PENDING_ACTIVATION as "PENDING_ACTIVATION",
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUserRepo = {
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updatePassword: vi.fn(),
    } as Mocked<IUserRepository>;

    mockAgreementLogRepo = {
      create: vi.fn(),
      createAndActivateUser: vi.fn(),
    } as Mocked<IAgreementLogRepository>;

    service = new SetupService(mockUserRepo, mockAgreementLogRepo);
  });

  // -----------------------------------------------
  // sendInviteEmail
  // -----------------------------------------------
  describe("sendInviteEmail", () => {
    it("test_sendInviteEmail_existing_user_calls_findById", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(mockUser);
      vi.mocked(tokenModule.generateInviteToken).mockReturnValue("mock-token");
      vi.mocked(emailServiceModule.sendInviteEmail).mockResolvedValue(undefined);

      // Act
      await service.sendInviteEmail("user-1", "https://example.com");

      // Assert
      expect(mockUserRepo.findById).toHaveBeenCalledWith("user-1");
    });

    it("test_sendInviteEmail_existing_user_calls_generateInviteToken", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(mockUser);
      vi.mocked(tokenModule.generateInviteToken).mockReturnValue("mock-token");
      vi.mocked(emailServiceModule.sendInviteEmail).mockResolvedValue(undefined);

      // Act
      await service.sendInviteEmail("user-1", "https://example.com");

      // Assert
      expect(tokenModule.generateInviteToken).toHaveBeenCalledWith("user-1");
    });

    it("test_sendInviteEmail_existing_user_calls_emailService_with_correct_url", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(mockUser);
      vi.mocked(tokenModule.generateInviteToken).mockReturnValue("mock-token");
      vi.mocked(emailServiceModule.sendInviteEmail).mockResolvedValue(undefined);

      // Act
      await service.sendInviteEmail("user-1", "https://example.com");

      // Assert
      const callArgs = vi.mocked(emailServiceModule.sendInviteEmail).mock.calls[0][0];
      expect(callArgs.setupUrl).toContain("mock-token");
    });

    it("test_sendInviteEmail_existing_user_calls_emailService_with_student_email", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(mockUser);
      vi.mocked(tokenModule.generateInviteToken).mockReturnValue("mock-token");
      vi.mocked(emailServiceModule.sendInviteEmail).mockResolvedValue(undefined);

      // Act
      await service.sendInviteEmail("user-1", "https://example.com");

      // Assert
      const callArgs = vi.mocked(emailServiceModule.sendInviteEmail).mock.calls[0][0];
      expect(callArgs.to).toBe("student@example.com");
    });

    it("test_sendInviteEmail_nonexistent_user_throws_UserNotFoundError", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(null);
      const { UserNotFoundError } = await import("@/services/errors");

      // Act & Assert
      await expect(
        service.sendInviteEmail("nonexistent", "https://example.com")
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  // -----------------------------------------------
  // setPassword
  // -----------------------------------------------
  describe("setPassword", () => {
    it("test_setPassword_valid_token_and_password_calls_updatePassword", async () => {
      // Arrange
      vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
        userId: "user-1",
      });
      mockUserRepo.findById.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$hashed" as never);
      mockUserRepo.updatePassword.mockResolvedValue(mockUser);

      // Act
      await service.setPassword("valid-token", "Password1");

      // Assert
      expect(mockUserRepo.updatePassword).toHaveBeenCalledOnce();
    });

    it("test_setPassword_valid_token_and_password_calls_updatePassword_with_userId", async () => {
      // Arrange
      vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
        userId: "user-1",
      });
      mockUserRepo.findById.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$hashed" as never);
      mockUserRepo.updatePassword.mockResolvedValue(mockUser);

      // Act
      await service.setPassword("valid-token", "Password1");

      // Assert
      const callArgs = mockUserRepo.updatePassword.mock.calls[0];
      expect(callArgs[0]).toBe("user-1");
    });

    it("test_setPassword_valid_token_and_password_hashes_password_with_bcrypt", async () => {
      // Arrange
      vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
        userId: "user-1",
      });
      mockUserRepo.findById.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$hashed" as never);
      mockUserRepo.updatePassword.mockResolvedValue(mockUser);

      // Act
      await service.setPassword("valid-token", "Password1");

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith("Password1", 12);
    });

    it("test_setPassword_invalid_token_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(tokenModule.verifyInviteToken).mockReturnValue(null);

      // Act & Assert
      await expect(service.setPassword("invalid-token", "Password1")).rejects.toThrow(
        BusinessError
      );
    });

    it("test_setPassword_password_too_short_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
        userId: "user-1",
      });

      // Act & Assert
      await expect(service.setPassword("valid-token", "Short1")).rejects.toThrow(BusinessError);
    });

    it("test_setPassword_password_no_uppercase_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
        userId: "user-1",
      });

      // Act & Assert
      await expect(service.setPassword("valid-token", "password1")).rejects.toThrow(BusinessError);
    });

    it("test_setPassword_password_no_digit_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
        userId: "user-1",
      });

      // Act & Assert
      await expect(service.setPassword("valid-token", "PasswordOnly")).rejects.toThrow(
        BusinessError
      );
    });

    it("test_setPassword_exactly_8_chars_with_requirements_succeeds", async () => {
      // Arrange
      vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
        userId: "user-1",
      });
      mockUserRepo.findById.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$hashed" as never);
      mockUserRepo.updatePassword.mockResolvedValue(mockUser);

      // Act & Assert - 例外が投げられないこと
      await expect(service.setPassword("valid-token", "Passw0rd")).resolves.not.toThrow();
    });
  });

  // -----------------------------------------------
  // agreeToTerms
  // -----------------------------------------------
  describe("agreeToTerms", () => {
    const mockLog = {
      id: "log-1",
      userId: "user-1",
      version: "1.0",
      agreedAt: new Date(),
      ipAddress: "127.0.0.1",
    };

    it("test_agreeToTerms_valid_userId_calls_createAndActivateUser", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockAgreementLogRepo.createAndActivateUser.mockResolvedValue(mockLog);

      // Act
      await service.agreeToTerms("user-1", "127.0.0.1");

      // Assert
      expect(mockAgreementLogRepo.createAndActivateUser).toHaveBeenCalledOnce();
    });

    it("test_agreeToTerms_valid_userId_calls_createAndActivateUser_with_userId", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockAgreementLogRepo.createAndActivateUser.mockResolvedValue(mockLog);

      // Act
      await service.agreeToTerms("user-1", "127.0.0.1");

      // Assert
      const callArgs = mockAgreementLogRepo.createAndActivateUser.mock.calls[0][0];
      expect(callArgs.userId).toBe("user-1");
    });

    it("test_agreeToTerms_valid_userId_passes_ip_address_to_log", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockAgreementLogRepo.createAndActivateUser.mockResolvedValue(mockLog);

      // Act
      await service.agreeToTerms("user-1", "192.168.1.100");

      // Assert
      const callArgs = mockAgreementLogRepo.createAndActivateUser.mock.calls[0][0];
      expect(callArgs.ipAddress).toBe("192.168.1.100");
    });

    it("test_agreeToTerms_nonexistent_user_throws_UserNotFoundError", async () => {
      // Arrange
      mockUserRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.agreeToTerms("unknown-user", "127.0.0.1")).rejects.toThrow(
        "指定された受講者が見つかりません"
      );
    });

    it("test_agreeToTerms_already_active_user_throws_BusinessError", async () => {
      // Arrange
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE as "ACTIVE" };
      mockUserRepo.findById.mockResolvedValue(activeUser);

      // Act & Assert
      await expect(service.agreeToTerms("user-1", "127.0.0.1")).rejects.toThrow(BusinessError);
    });
  });
});
