import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import { UserRepository } from "@/repositories/userRepository";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

// Prisma Client をモック
vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    user: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
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
    mockFindMany.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
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

  describe("findAll", () => {
    it("test_findAll_no_filter_returns_all_users", async () => {
      const mockUsers = [mockUser, { ...mockUser, id: "user-2" }];
      mockFindMany.mockResolvedValue(mockUsers);

      const result = await repository.findAll();

      expect(result).toEqual(mockUsers);
    });

    it("test_findAll_no_filter_calls_findMany_with_default_limit", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll();

      // デフォルト limit=500 で全件取得を防ぐ
      expect(mockFindMany).toHaveBeenCalledWith({ where: undefined, take: 500 });
    });

    it("test_findAll_with_status_filter_returns_filtered_users", async () => {
      const activeUsers = [mockUser];
      mockFindMany.mockResolvedValue(activeUsers);

      const result = await repository.findAll({ status: UserStatus.ACTIVE });

      expect(result).toEqual(activeUsers);
    });

    it("test_findAll_with_status_filter_calls_findMany_with_where_and_limit", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll({ status: UserStatus.ACTIVE });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { status: UserStatus.ACTIVE },
        take: 500,
      });
    });

    it("test_findAll_with_custom_limit_calls_findMany_with_take", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll(undefined, 10);

      expect(mockFindMany).toHaveBeenCalledWith({ where: undefined, take: 10 });
    });
  });

  describe("findById", () => {
    it("test_findById_existing_id_returns_user", async () => {
      mockFindUnique.mockResolvedValue(mockUser);

      const result = await repository.findById("user-1");

      expect(result).toEqual(mockUser);
    });

    it("test_findById_existing_id_calls_findUnique_with_id", async () => {
      mockFindUnique.mockResolvedValue(mockUser);

      await repository.findById("user-1");

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
    });

    it("test_findById_nonexistent_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    const createInput = {
      email: "new@example.com",
      name: "New User",
      passwordHash: "hashed_pw",
      courseType: CourseType.BEGINNER,
      role: UserRole.STUDENT,
      status: UserStatus.PENDING_REGISTRATION,
    };

    it("test_create_valid_data_returns_created_user", async () => {
      const createdUser = { ...mockUser, ...createInput, id: "user-new" };
      mockCreate.mockResolvedValue(createdUser);

      const result = await repository.create(createInput);

      expect(result).toEqual(createdUser);
    });

    it("test_create_valid_data_calls_prisma_create_with_data", async () => {
      mockCreate.mockResolvedValue({ ...mockUser, ...createInput });

      await repository.create(createInput);

      expect(mockCreate).toHaveBeenCalledWith({ data: createInput });
    });
  });

  describe("updateStatus", () => {
    it("test_updateStatus_existing_user_returns_updated_user", async () => {
      const updatedUser = { ...mockUser, status: UserStatus.EXAM_PASSED };
      mockUpdate.mockResolvedValue(updatedUser);

      const result = await repository.updateStatus("user-1", UserStatus.EXAM_PASSED);

      expect(result).toEqual(updatedUser);
    });

    it("test_updateStatus_existing_user_calls_prisma_update_with_correct_args", async () => {
      mockUpdate.mockResolvedValue({ ...mockUser, status: UserStatus.EXAM_PASSED });

      await repository.updateStatus("user-1", UserStatus.EXAM_PASSED);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { status: UserStatus.EXAM_PASSED },
      });
    });
  });

  describe("updatePassword", () => {
    it("test_updatePassword_valid_args_returns_updated_user", async () => {
      // Arrange
      const updatedUser = { ...mockUser, passwordHash: "$2b$10$newhashedpassword" };
      mockUpdate.mockResolvedValue(updatedUser);

      // Act
      const result = await repository.updatePassword("user-1", "$2b$10$newhashedpassword");

      // Assert
      expect(result).toEqual(updatedUser);
    });

    it("test_updatePassword_valid_args_calls_prisma_update_with_correct_id", async () => {
      // Arrange
      mockUpdate.mockResolvedValue({ ...mockUser });

      // Act
      await repository.updatePassword("user-1", "$2b$10$newhashedpassword");

      // Assert
      const callArgs = mockUpdate.mock.calls[0][0];
      expect(callArgs.where).toEqual({ id: "user-1" });
    });

    it("test_updatePassword_valid_args_calls_prisma_update_with_passwordHash", async () => {
      // Arrange
      mockUpdate.mockResolvedValue({ ...mockUser });

      // Act
      await repository.updatePassword("user-1", "$2b$10$newhashedpassword");

      // Assert
      const callArgs = mockUpdate.mock.calls[0][0];
      expect(callArgs.data).toEqual({ passwordHash: "$2b$10$newhashedpassword" });
    });

    it("test_updatePassword_prisma_error_propagates", async () => {
      // Arrange
      mockUpdate.mockRejectedValue(new Error("DB error"));

      // Act & Assert
      await expect(repository.updatePassword("user-1", "hash")).rejects.toThrow("DB error");
    });
  });
});
