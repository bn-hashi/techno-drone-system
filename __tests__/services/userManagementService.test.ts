import { describe, it, expect, beforeEach, vi, Mocked } from "vitest";
import { User } from "@prisma/client";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import { UserManagementService } from "@/services/userManagementService";
import type { IUserRepository } from "@/repositories/userRepository";

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}));

import bcrypt from "bcryptjs";

describe("UserManagementService", () => {
  let service: UserManagementService;
  let mockRepo: Mocked<IUserRepository>;

  const mockUser: User = {
    id: "user-1",
    email: "student@example.com",
    name: "Test Student",
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

    mockRepo = {
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updatePassword: vi.fn(),
    } as Mocked<IUserRepository>;

    service = new UserManagementService(mockRepo);
  });

  // -----------------------------------------------
  // listUsers
  // -----------------------------------------------
  describe("listUsers", () => {
    it("test_listUsers_no_filter_returns_users_without_passwordHash", async () => {
      mockRepo.findAll.mockResolvedValue([mockUser]);

      const result = await service.listUsers();

      expect(result[0]).not.toHaveProperty("passwordHash");
    });

    it("test_listUsers_no_filter_returns_correct_user_data", async () => {
      mockRepo.findAll.mockResolvedValue([mockUser]);

      const result = await service.listUsers();

      expect(result[0].email).toBe(mockUser.email);
    });

    it("test_listUsers_with_status_filter_passes_filter_to_repository", async () => {
      mockRepo.findAll.mockResolvedValue([]);

      await service.listUsers({ status: UserStatus.ACTIVE });

      expect(mockRepo.findAll).toHaveBeenCalledWith({ status: UserStatus.ACTIVE });
    });

    it("test_listUsers_empty_result_returns_empty_array", async () => {
      mockRepo.findAll.mockResolvedValue([]);

      const result = await service.listUsers();

      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------
  // createUser
  // -----------------------------------------------
  describe("createUser", () => {
    const createInput = {
      email: "new@example.com",
      name: "New Student",
      password: "Password1",
      courseType: CourseType.BEGINNER,
    };

    beforeEach(() => {
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue({
        ...mockUser,
        email: createInput.email,
        name: createInput.name,
        status: UserStatus.PENDING_REGISTRATION,
        role: UserRole.STUDENT,
      });
      vi.mocked(bcrypt.hash).mockResolvedValue("hashed_pw" as never);
    });

    it("test_createUser_valid_input_returns_user_without_passwordHash", async () => {
      const result = await service.createUser(createInput);

      expect(result).not.toHaveProperty("passwordHash");
    });

    it("test_createUser_valid_input_returns_correct_email", async () => {
      const result = await service.createUser(createInput);

      expect(result.email).toBe(createInput.email);
    });

    it("test_createUser_valid_input_hashes_password_with_salt_12", async () => {
      await service.createUser(createInput);

      expect(bcrypt.hash).toHaveBeenCalledWith(createInput.password, 12);
    });

    it("test_createUser_valid_input_sets_role_to_STUDENT", async () => {
      mockRepo.create.mockResolvedValue({
        ...mockUser,
        role: UserRole.STUDENT,
      });

      const result = await service.createUser(createInput);

      expect(result.role).toBe(UserRole.STUDENT);
    });

    it("test_createUser_valid_input_sets_initial_status_to_PENDING_REGISTRATION", async () => {
      mockRepo.create.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING_REGISTRATION,
      });

      const result = await service.createUser(createInput);

      expect(result.status).toBe(UserStatus.PENDING_REGISTRATION);
    });

    it("test_createUser_duplicate_email_throws_error", async () => {
      mockRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(service.createUser(createInput)).rejects.toThrow(
        "このメールアドレスはすでに使用されています"
      );
    });

    it("test_createUser_empty_email_throws_validation_error", async () => {
      await expect(service.createUser({ ...createInput, email: "" })).rejects.toThrow(
        "メールアドレスは必須です"
      );
    });

    it("test_createUser_empty_name_throws_validation_error", async () => {
      await expect(service.createUser({ ...createInput, name: "" })).rejects.toThrow(
        "氏名は必須です"
      );
    });

    it("test_createUser_empty_password_throws_validation_error", async () => {
      await expect(service.createUser({ ...createInput, password: "" })).rejects.toThrow(
        "パスワードは必須です"
      );
    });

    it("test_createUser_password_too_short_throws_validation_error", async () => {
      await expect(service.createUser({ ...createInput, password: "short" })).rejects.toThrow(
        "パスワードは8文字以上で入力してください"
      );
    });

    it("test_createUser_invalid_email_format_throws_validation_error", async () => {
      await expect(service.createUser({ ...createInput, email: "not-an-email" })).rejects.toThrow(
        "メールアドレスの形式が正しくありません"
      );
    });

    it("test_createUser_valid_input_calls_repo_create_with_role_STUDENT", async () => {
      await service.createUser(createInput);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.STUDENT })
      );
    });

    it("test_createUser_valid_input_calls_repo_create_with_status_PENDING_REGISTRATION", async () => {
      await service.createUser(createInput);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.PENDING_REGISTRATION })
      );
    });
  });

  // -----------------------------------------------
  // updateStatus
  // -----------------------------------------------
  describe("updateStatus", () => {
    it("test_updateStatus_valid_transition_returns_user_without_passwordHash", async () => {
      mockRepo.findById.mockResolvedValue(mockUser); // status: ACTIVE
      mockRepo.updateStatus.mockResolvedValue({
        ...mockUser,
        status: UserStatus.EXAM_PASSED,
      });

      const result = await service.updateStatus("user-1", UserStatus.EXAM_PASSED);

      expect(result).not.toHaveProperty("passwordHash");
    });

    it("test_updateStatus_valid_transition_returns_new_status", async () => {
      mockRepo.findById.mockResolvedValue(mockUser); // status: ACTIVE
      mockRepo.updateStatus.mockResolvedValue({
        ...mockUser,
        status: UserStatus.EXAM_PASSED,
      });

      const result = await service.updateStatus("user-1", UserStatus.EXAM_PASSED);

      expect(result.status).toBe(UserStatus.EXAM_PASSED);
    });

    it("test_updateStatus_invalid_transition_throws_error", async () => {
      mockRepo.findById.mockResolvedValue(mockUser); // status: ACTIVE

      // ACTIVE -> PENDING_REGISTRATION は不正
      await expect(service.updateStatus("user-1", UserStatus.PENDING_REGISTRATION)).rejects.toThrow(
        "無効なステータス遷移です"
      );
    });

    it("test_updateStatus_nonexistent_user_throws_not_found_error", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.updateStatus("nonexistent", UserStatus.EXAM_PASSED)).rejects.toThrow(
        "指定された受講者が見つかりません"
      );
    });

    it("test_updateStatus_same_status_throws_error", async () => {
      mockRepo.findById.mockResolvedValue(mockUser); // status: ACTIVE

      await expect(service.updateStatus("user-1", UserStatus.ACTIVE)).rejects.toThrow(
        "無効なステータス遷移です"
      );
    });

    it("test_updateStatus_DIPS_LINKED_throws_error", async () => {
      mockRepo.findById.mockResolvedValue({
        ...mockUser,
        status: UserStatus.DIPS_LINKED,
      });

      await expect(service.updateStatus("user-1", UserStatus.CERTIFIED)).rejects.toThrow(
        "無効なステータス遷移です"
      );
    });

    it("test_updateStatus_with_tx_passes_tx_to_findById", async () => {
      // Arrange
      mockRepo.findById.mockResolvedValue(mockUser);
      mockRepo.updateStatus.mockResolvedValue({
        ...mockUser,
        status: UserStatus.EXAM_PASSED,
      });
      const txClient = { __tx: true } as never;

      // Act
      await service.updateStatus("user-1", UserStatus.EXAM_PASSED, txClient);

      // Assert
      expect(mockRepo.findById).toHaveBeenCalledWith("user-1", txClient);
    });

    it("test_updateStatus_with_tx_passes_tx_to_repo_updateStatus", async () => {
      // Arrange
      mockRepo.findById.mockResolvedValue(mockUser);
      mockRepo.updateStatus.mockResolvedValue({
        ...mockUser,
        status: UserStatus.EXAM_PASSED,
      });
      const txClient = { __tx: true } as never;

      // Act
      await service.updateStatus("user-1", UserStatus.EXAM_PASSED, txClient);

      // Assert
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        "user-1",
        UserStatus.EXAM_PASSED,
        txClient
      );
    });
  });
});
