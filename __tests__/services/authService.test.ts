import { describe, it, expect, beforeEach, vi, Mocked } from "vitest";
import { User } from "@prisma/client";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import { AuthService } from "@/services/authService";
import type { IUserRepository } from "@/repositories/userRepository";

// bcryptjs モック
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

import bcrypt from "bcryptjs";

describe("AuthService", () => {
  let authService: AuthService;
  let mockUserRepository: Mocked<IUserRepository>;

  const mockUser: User = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "$2b$10$hashedpassword",
    role: UserRole.STUDENT,
    courseType: CourseType.BEGINNER,
    status: UserStatus.ACTIVE,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // IUserRepository スタブ実装（新メソッドも含む）
    mockUserRepository = {
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
    } as Mocked<IUserRepository>;

    authService = new AuthService(mockUserRepository);
  });

  describe("login", () => {
    describe("valid credentials with active status", () => {
      let result: Awaited<ReturnType<typeof authService.login>>;

      beforeEach(async () => {
        mockUserRepository.findByEmail.mockResolvedValue(mockUser);
        vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(true));
        result = await authService.login("test@example.com", "password123");
      });

      it("test_login_valid_credentials_active_status_success_is_true", () => {
        expect(result.success).toBe(true);
      });

      it("test_login_valid_credentials_active_status_user_equals_safe_user", () => {
        const { passwordHash: _passwordHash, ...expectedSafeUser } = mockUser;
        expect(result.user).toEqual(expectedSafeUser);
      });

      it("test_login_valid_credentials_active_status_error_is_undefined", () => {
        expect(result.error).toBeUndefined();
      });

      it("test_login_success_includes_role_in_result", () => {
        expect(result.user?.role).toBe(UserRole.STUDENT);
      });

      it("test_login_success_includes_status_in_result", () => {
        expect(result.user?.status).toBe(UserStatus.ACTIVE);
      });
    });

    describe("invalid password", () => {
      let result: Awaited<ReturnType<typeof authService.login>>;

      beforeEach(async () => {
        mockUserRepository.findByEmail.mockResolvedValue(mockUser);
        vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(false));
        result = await authService.login("test@example.com", "wrongpassword");
      });

      it("test_login_invalid_password_success_is_false", () => {
        expect(result.success).toBe(false);
      });

      it("test_login_invalid_password_error_is_invalid_credentials", () => {
        expect(result.error).toBe("invalid_credentials");
      });

      it("test_login_invalid_password_user_is_undefined", () => {
        expect(result.user).toBeUndefined();
      });
    });

    describe("nonexistent email", () => {
      let result: Awaited<ReturnType<typeof authService.login>>;

      beforeEach(async () => {
        mockUserRepository.findByEmail.mockResolvedValue(null);
        result = await authService.login("nonexistent@example.com", "password123");
      });

      it("test_login_nonexistent_email_success_is_false", () => {
        expect(result.success).toBe(false);
      });

      it("test_login_nonexistent_email_error_is_invalid_credentials", () => {
        expect(result.error).toBe("invalid_credentials");
      });

      it("test_login_nonexistent_email_user_is_undefined", () => {
        expect(result.user).toBeUndefined();
      });
    });

    describe("pending registration status", () => {
      let result: Awaited<ReturnType<typeof authService.login>>;

      beforeEach(async () => {
        const pendingUser: User = { ...mockUser, status: UserStatus.PENDING_REGISTRATION };
        mockUserRepository.findByEmail.mockResolvedValue(pendingUser);
        vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(true));
        result = await authService.login("test@example.com", "password123");
      });

      it("test_login_pending_registration_success_is_false", () => {
        expect(result.success).toBe(false);
      });

      it("test_login_pending_registration_error_is_account_not_active", () => {
        expect(result.error).toBe("account_not_active");
      });

      it("test_login_pending_registration_user_is_undefined", () => {
        expect(result.user).toBeUndefined();
      });
    });

    describe("pending activation status", () => {
      let result: Awaited<ReturnType<typeof authService.login>>;

      beforeEach(async () => {
        const pendingUser: User = { ...mockUser, status: UserStatus.PENDING_ACTIVATION };
        mockUserRepository.findByEmail.mockResolvedValue(pendingUser);
        vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(true));
        result = await authService.login("test@example.com", "password123");
      });

      it("test_login_pending_activation_success_is_false", () => {
        expect(result.success).toBe(false);
      });

      it("test_login_pending_activation_error_is_account_pending", () => {
        expect(result.error).toBe("account_pending");
      });

      it("test_login_pending_activation_user_is_undefined", () => {
        expect(result.user).toBeUndefined();
      });
    });

    describe("unknown disallowed status", () => {
      let result: Awaited<ReturnType<typeof authService.login>>;

      beforeEach(async () => {
        // isLoginAllowed が false を返すが、既知のステータス以外（将来追加ステータス等）
        const unknownStatusUser: User = {
          ...mockUser,
          status: "FUTURE_STATUS" as unknown as UserStatus,
        };
        mockUserRepository.findByEmail.mockResolvedValue(unknownStatusUser);
        result = await authService.login("test@example.com", "password123");
      });

      it("test_login_unknown_disallowed_status_success_is_false", () => {
        expect(result.success).toBe(false);
      });

      it("test_login_unknown_disallowed_status_error_is_account_not_active", () => {
        expect(result.error).toBe("account_not_active");
      });

      it("test_login_unknown_disallowed_status_user_is_undefined", () => {
        expect(result.user).toBeUndefined();
      });
    });
  });
});
