import { describe, it, expect, beforeEach, vi, Mocked } from "vitest";
import { EnrollmentService } from "@/services/enrollmentService";
import type { IEnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import type { IUserRepository } from "@/repositories/userRepository";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import {
  BusinessError,
  DuplicateEnrollmentError,
  EnrollmentNotFoundError,
  UserNotFoundError,
} from "@/services/errors";

vi.mock("@/lib/upload", () => ({
  saveUploadedFile: vi.fn(),
}));

vi.mock("@/lib/fsAdapter", () => ({
  unlinkFile: vi.fn(),
}));

import { saveUploadedFile } from "@/lib/upload";
import { unlinkFile } from "@/lib/fsAdapter";

describe("EnrollmentService", () => {
  let service: EnrollmentService;
  let mockEnrollmentRepo: Mocked<IEnrollmentApplicationRepository>;
  let mockUserRepo: Mocked<IUserRepository>;

  const mockUser = {
    id: "user-1",
    email: "student@example.com",
    name: "Test Student",
    passwordHash: "$2b$10$hashed",
    role: UserRole.STUDENT as string,
    courseType: CourseType.BEGINNER as string,
    status: UserStatus.ACTIVE as string,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApplication = {
    id: "app-1",
    userId: "user-1",
    applicationDate: new Date("2026-05-01"),
    dateOfBirth: new Date("1990-01-15"),
    address: "東京都千代田区1-1-1",
    phoneNumber: "090-1234-5678",
    idDocumentPath: null,
    photoPath: null,
    experienceCertPath: null,
    applicantNumber: null,
    acceptedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createInput = {
    userId: "user-1",
    dateOfBirth: new Date("1990-01-15"),
    address: "東京都千代田区1-1-1",
    phoneNumber: "090-1234-5678",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnrollmentRepo = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      accept: vi.fn(),
    } as Mocked<IEnrollmentApplicationRepository>;

    mockUserRepo = {
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updatePassword: vi.fn(),
    } as Mocked<IUserRepository>;

    service = new EnrollmentService(mockEnrollmentRepo, mockUserRepo);
  });

  // -----------------------------------------------
  // createEnrollment
  // -----------------------------------------------
  describe("createEnrollment", () => {
    beforeEach(() => {
      mockUserRepo.findById.mockResolvedValue(mockUser as never);
      mockEnrollmentRepo.findByUserId.mockResolvedValue(null);
      mockEnrollmentRepo.create.mockResolvedValue(mockApplication);
    });

    it("test_createEnrollment_valid_input_returns_application", async () => {
      const result = await service.createEnrollment(createInput);

      expect(result).toEqual(mockApplication);
    });

    it("test_createEnrollment_valid_input_calls_repo_create", async () => {
      await service.createEnrollment(createInput);

      expect(mockEnrollmentRepo.create).toHaveBeenCalledWith(createInput);
    });

    it("test_createEnrollment_duplicate_user_throws_error", async () => {
      mockEnrollmentRepo.findByUserId.mockResolvedValue(mockApplication);

      await expect(service.createEnrollment(createInput)).rejects.toThrow(DuplicateEnrollmentError);
    });

    it("test_createEnrollment_nonexistent_user_throws_error", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(service.createEnrollment(createInput)).rejects.toThrow(UserNotFoundError);
    });

    it("test_createEnrollment_empty_address_throws_business_error", async () => {
      await expect(service.createEnrollment({ ...createInput, address: "" })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_createEnrollment_empty_address_throws_correct_message", async () => {
      await expect(service.createEnrollment({ ...createInput, address: "" })).rejects.toThrow(
        "住所は必須です"
      );
    });

    it("test_createEnrollment_empty_phoneNumber_throws_business_error", async () => {
      await expect(service.createEnrollment({ ...createInput, phoneNumber: "" })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_createEnrollment_empty_phoneNumber_throws_correct_message", async () => {
      await expect(service.createEnrollment({ ...createInput, phoneNumber: "" })).rejects.toThrow(
        "電話番号は必須です"
      );
    });

    it("test_createEnrollment_missing_dateOfBirth_throws_business_error", async () => {
      await expect(
        service.createEnrollment({ ...createInput, dateOfBirth: null as unknown as Date })
      ).rejects.toThrow(BusinessError);
    });

    it("test_createEnrollment_missing_dateOfBirth_throws_correct_message", async () => {
      await expect(
        service.createEnrollment({ ...createInput, dateOfBirth: null as unknown as Date })
      ).rejects.toThrow("生年月日は必須です");
    });

    it("test_createEnrollment_future_dateOfBirth_throws_business_error", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await expect(
        service.createEnrollment({ ...createInput, dateOfBirth: futureDate })
      ).rejects.toThrow(BusinessError);
    });

    it("test_createEnrollment_future_dateOfBirth_throws_correct_message", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await expect(
        service.createEnrollment({ ...createInput, dateOfBirth: futureDate })
      ).rejects.toThrow("生年月日に未来の日付は使用できません");
    });
  });

  // -----------------------------------------------
  // uploadDocuments
  // -----------------------------------------------
  describe("uploadDocuments", () => {
    const validFile = new File(["content"], "id.jpg", { type: "image/jpeg" });
    beforeEach(() => {
      vi.mocked(saveUploadedFile).mockResolvedValue("/home/ubuntu/uploads/id-documents/uuid.jpg");
      mockEnrollmentRepo.findByUserId.mockResolvedValue(mockApplication);
      mockEnrollmentRepo.update.mockResolvedValue(mockApplication);
      vi.mocked(unlinkFile).mockResolvedValue(undefined);
    });

    it("test_uploadDocuments_valid_single_file_saves_and_updates_db", async () => {
      // Arrange
      const fileEntries = [{ field: "idDocument" as const, file: validFile }];

      // Act
      await service.uploadDocuments("user-1", fileEntries);

      // Assert
      expect(saveUploadedFile).toHaveBeenCalledTimes(1);
    });

    it("test_uploadDocuments_valid_multiple_files_saves_all", async () => {
      // Arrange
      const photoFile = new File(["content"], "photo.jpg", { type: "image/jpeg" });
      const fileEntries = [
        { field: "idDocument" as const, file: validFile },
        { field: "photo" as const, file: photoFile },
      ];

      // Act
      await service.uploadDocuments("user-1", fileEntries);

      // Assert
      expect(saveUploadedFile).toHaveBeenCalledTimes(2);
    });

    it("test_uploadDocuments_calls_repo_update_with_saved_paths", async () => {
      // Arrange
      const savedPath = "/home/ubuntu/uploads/id-documents/uuid.jpg";
      vi.mocked(saveUploadedFile).mockResolvedValue(savedPath);
      const fileEntries = [{ field: "idDocument" as const, file: validFile }];

      // Act
      await service.uploadDocuments("user-1", fileEntries);

      // Assert
      expect(mockEnrollmentRepo.update).toHaveBeenCalledWith("app-1", {
        idDocumentPath: savedPath,
      });
    });

    it("test_uploadDocuments_no_application_throws_EnrollmentNotFoundError", async () => {
      // Arrange
      mockEnrollmentRepo.findByUserId.mockResolvedValue(null);
      const fileEntries = [{ field: "idDocument" as const, file: validFile }];

      // Act & Assert
      await expect(service.uploadDocuments("user-1", fileEntries)).rejects.toThrow(
        EnrollmentNotFoundError
      );
    });

    it("test_uploadDocuments_empty_file_entries_throws_BusinessError", async () => {
      // Arrange
      const fileEntries: Array<{ field: "idDocument" | "photo" | "experienceCert"; file: File }> =
        [];

      // Act & Assert
      await expect(service.uploadDocuments("user-1", fileEntries)).rejects.toThrow(BusinessError);
    });

    // Issue #12: 0バイトファイルと有効ファイルの混在で400を返すべき
    it("test_uploadDocuments_zero_byte_file_mixed_with_valid_throws_BusinessError", async () => {
      // Arrange
      const zeroByteFile = new File([], "empty.jpg", { type: "image/jpeg" });
      const fileEntries = [
        { field: "idDocument" as const, file: validFile },
        { field: "photo" as const, file: zeroByteFile },
      ];

      // Act & Assert
      await expect(service.uploadDocuments("user-1", fileEntries)).rejects.toThrow(BusinessError);
    });

    // Issue #12: 0バイトファイルのみの場合も BusinessError
    it("test_uploadDocuments_zero_byte_file_only_throws_BusinessError", async () => {
      // Arrange
      const zeroByteFile = new File([], "empty.jpg", { type: "image/jpeg" });
      const fileEntries = [{ field: "idDocument" as const, file: zeroByteFile }];

      // Act & Assert
      await expect(service.uploadDocuments("user-1", fileEntries)).rejects.toThrow(BusinessError);
    });

    // Issue #13: ファイル保存途中で失敗した場合はエラーを re-throw する
    it("test_uploadDocuments_file_save_failure_rethrows_error", async () => {
      // Arrange
      const photoFile = new File(["content"], "photo.jpg", { type: "image/jpeg" });
      const savedPath = "/home/ubuntu/uploads/id-documents/uuid.jpg";
      vi.mocked(saveUploadedFile)
        .mockResolvedValueOnce(savedPath)
        .mockRejectedValueOnce(new Error("Disk full"));
      const fileEntries = [
        { field: "idDocument" as const, file: validFile },
        { field: "photo" as const, file: photoFile },
      ];

      // Act & Assert
      await expect(service.uploadDocuments("user-1", fileEntries)).rejects.toThrow("Disk full");
    });

    // Issue #13: ファイル保存途中で失敗した場合は保存済みファイルを全て削除する
    it("test_uploadDocuments_file_save_failure_cleans_up_already_saved_files", async () => {
      // Arrange
      const photoFile = new File(["content"], "photo.jpg", { type: "image/jpeg" });
      const savedPath = "/home/ubuntu/uploads/id-documents/uuid.jpg";
      vi.mocked(saveUploadedFile)
        .mockResolvedValueOnce(savedPath)
        .mockRejectedValueOnce(new Error("Disk full"));
      const fileEntries = [
        { field: "idDocument" as const, file: validFile },
        { field: "photo" as const, file: photoFile },
      ];

      // Act
      await service.uploadDocuments("user-1", fileEntries).catch(() => undefined);

      // Assert
      expect(unlinkFile).toHaveBeenCalledWith(savedPath);
    });

    // Issue #13: DB更新失敗時はエラーを re-throw する
    it("test_uploadDocuments_db_update_failure_rethrows_error", async () => {
      // Arrange
      const savedPath = "/home/ubuntu/uploads/id-documents/uuid.jpg";
      vi.mocked(saveUploadedFile).mockResolvedValue(savedPath);
      mockEnrollmentRepo.update.mockRejectedValue(new Error("DB connection lost"));
      const fileEntries = [{ field: "idDocument" as const, file: validFile }];

      // Act & Assert
      await expect(service.uploadDocuments("user-1", fileEntries)).rejects.toThrow(
        "DB connection lost"
      );
    });

    // Issue #13: DB更新失敗時は全ファイルを削除する
    it("test_uploadDocuments_db_update_failure_cleans_up_all_saved_files", async () => {
      // Arrange
      const savedPath = "/home/ubuntu/uploads/id-documents/uuid.jpg";
      vi.mocked(saveUploadedFile).mockResolvedValue(savedPath);
      mockEnrollmentRepo.update.mockRejectedValue(new Error("DB connection lost"));
      const fileEntries = [{ field: "idDocument" as const, file: validFile }];

      // Act
      await service.uploadDocuments("user-1", fileEntries).catch(() => undefined);

      // Assert
      expect(unlinkFile).toHaveBeenCalledWith(savedPath);
    });
  });

  // -----------------------------------------------
  // acceptEnrollment
  // -----------------------------------------------
  describe("acceptEnrollment", () => {
    it("test_acceptEnrollment_returns_accepted_application", async () => {
      mockEnrollmentRepo.findById.mockResolvedValue(mockApplication);
      const acceptedApp = { ...mockApplication, acceptedAt: new Date() };
      mockEnrollmentRepo.accept.mockResolvedValue(acceptedApp);

      const result = await service.acceptEnrollment("app-1");

      expect(result.acceptedAt).not.toBeNull();
    });

    it("test_acceptEnrollment_calls_repo_accept_with_correct_args", async () => {
      mockEnrollmentRepo.findById.mockResolvedValue(mockApplication);
      mockEnrollmentRepo.accept.mockResolvedValue({ ...mockApplication, acceptedAt: new Date() });

      await service.acceptEnrollment("app-1");

      expect(mockEnrollmentRepo.accept).toHaveBeenCalledWith("app-1", "user-1");
    });

    it("test_acceptEnrollment_nonexistent_application_throws_error", async () => {
      mockEnrollmentRepo.findById.mockResolvedValue(null);

      await expect(service.acceptEnrollment("nonexistent")).rejects.toThrow(
        EnrollmentNotFoundError
      );
    });
  });

  // -----------------------------------------------
  // listEnrollments
  // -----------------------------------------------
  describe("listEnrollments", () => {
    const mockApplicationWithUser = {
      ...mockApplication,
      user: { name: "テスト受講者", email: "student@example.com" },
    };

    it("test_listEnrollments_returns_all_applications", async () => {
      mockEnrollmentRepo.findAll = vi.fn().mockResolvedValue([mockApplicationWithUser]);

      const result = await service.listEnrollments();

      expect(result).toEqual([mockApplicationWithUser]);
      expect(mockEnrollmentRepo.findAll).toHaveBeenCalledOnce();
    });

    it("test_listEnrollments_empty_returns_empty_array", async () => {
      mockEnrollmentRepo.findAll = vi.fn().mockResolvedValue([]);

      const result = await service.listEnrollments();

      expect(result).toEqual([]);
    });
  });
});
