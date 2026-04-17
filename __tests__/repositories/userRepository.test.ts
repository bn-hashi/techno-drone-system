import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import { UserRepository } from "@/repositories/userRepository";

const mockFindUnique = vi.fn();

// Prisma Client をモック
vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    user: {
      findUnique: mockFindUnique,
    },
  }),
}));

describe("UserRepository", () => {
  let repository: UserRepository;

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "hashed_password",
    role: UserRole.STUDENT,
    courseType: CourseType.BEGINNER,
    status: UserStatus.ACTIVE,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockFindUnique.mockReset();
    repository = new UserRepository();
  });

  describe("findByEmail", () => {
    it("test_findByEmail_existing_email_returns_user", async () => {
      mockFindUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
    });

    it("test_findByEmail_existing_email_calls_findUnique_with_email", async () => {
      mockFindUnique.mockResolvedValue(mockUser);

      await repository.findByEmail("test@example.com");

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });

    it("test_findByEmail_nonexistent_email_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });

    it("test_findByEmail_nonexistent_email_calls_findUnique_with_email", async () => {
      mockFindUnique.mockResolvedValue(null);

      await repository.findByEmail("nonexistent@example.com");

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: "nonexistent@example.com" },
      });
    });

    it("test_findByEmail_calls_findUnique_with_correct_where_clause", async () => {
      mockFindUnique.mockResolvedValue(null);

      await repository.findByEmail("user@test.com");

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: "user@test.com" },
      });
    });
  });
});
