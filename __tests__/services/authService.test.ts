import { describe, it, expect, beforeEach, vi } from "vitest"
import { User } from "@prisma/client"
import { UserRole, UserStatus, CourseType } from "@/types/prisma"
import { AuthService, LoginResult, IUserRepository } from "@/services/authService"

// bcryptjs モック
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}))

import bcrypt from "bcryptjs"

describe("AuthService", () => {
  let authService: AuthService
  let mockUserRepository: any

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
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // IUserRepository スタブ実装
    mockUserRepository = {
      findByEmail: vi.fn(),
    } as any as IUserRepository

    authService = new AuthService(mockUserRepository)
  })

  describe("login", () => {
    it("test_login_valid_credentials_active_status_returns_success", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await authService.login("test@example.com", "password123")

      expect(result.success).toBe(true)
      expect(result.user).toEqual(mockUser)
      expect(result.error).toBeUndefined()
    })

    it("test_login_invalid_password_returns_invalid_credentials", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      const result = await authService.login("test@example.com", "wrongpassword")

      expect(result.success).toBe(false)
      expect(result.error).toBe("invalid_credentials")
      expect(result.user).toBeUndefined()
    })

    it("test_login_nonexistent_email_returns_invalid_credentials", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null)

      const result = await authService.login("nonexistent@example.com", "password123")

      expect(result.success).toBe(false)
      expect(result.error).toBe("invalid_credentials")
      expect(result.user).toBeUndefined()
    })

    it("test_login_pending_registration_returns_account_not_active", async () => {
      const pendingUser: User = { ...mockUser, status: UserStatus.PENDING_REGISTRATION }
      mockUserRepository.findByEmail.mockResolvedValue(pendingUser)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await authService.login("test@example.com", "password123")

      expect(result.success).toBe(false)
      expect(result.error).toBe("account_not_active")
      expect(result.user).toBeUndefined()
    })

    it("test_login_pending_activation_returns_account_pending", async () => {
      const pendingUser: User = { ...mockUser, status: UserStatus.PENDING_ACTIVATION }
      mockUserRepository.findByEmail.mockResolvedValue(pendingUser)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await authService.login("test@example.com", "password123")

      expect(result.success).toBe(false)
      expect(result.error).toBe("account_pending")
      expect(result.user).toBeUndefined()
    })

    it("test_login_success_includes_role_in_result", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await authService.login("test@example.com", "password123")

      expect(result.user?.role).toBe(UserRole.STUDENT)
    })

    it("test_login_success_includes_status_in_result", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await authService.login("test@example.com", "password123")

      expect(result.user?.status).toBe(UserStatus.ACTIVE)
    })
  })
})
