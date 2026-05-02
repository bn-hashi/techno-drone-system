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

// saveUploadedFile をモック
const mockSaveUploadedFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/upload", () => ({
  saveUploadedFile: mockSaveUploadedFile,
}));

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
      create: vi.fn(),
      update: vi.fn(),
    } as Mocked<IEnrollmentApplicationRepository>;

    mockUserRepo = {
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
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

      await expect(service.createEnrollment(createInput)).rejects.toThrow(
        DuplicateEnrollmentError
      );
    });

    it("test_createEnrollment_nonexistent_user_throws_error", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(service.createEnrollment(createInput)).rejects.toThrow(
        UserNotFoundError
      );
    });

    it("test_createEnrollment_empty_address_throws_validation_error", async () => {
      await expect(
        service.createEnrollment({ ...createInput, address: "" })
      ).rejects.toThrow(BusinessError);
      await expect(
        service.createEnrollment({ ...createInput, address: "" })
      ).rejects.toThrow("住所は必須です");
    });

    it("test_createEnrollment_empty_phoneNumber_throws_validation_error", async () => {
      await expect(
        service.createEnrollment({ ...createInput, phoneNumber: "" })
      ).rejects.toThrow(BusinessError);
      await expect(
        service.createEnrollment({ ...createInput, phoneNumber: "" })
      ).rejects.toThrow("電話番号は必須です");
    });

    it("test_createEnrollment_missing_dateOfBirth_throws_validation_error", async () => {
      await expect(
        service.createEnrollment({ ...createInput, dateOfBirth: null as unknown as Date })
      ).rejects.toThrow(BusinessError);
      await expect(
        service.createEnrollment({ ...createInput, dateOfBirth: null as unknown as Date })
      ).rejects.toThrow("生年月日は必須です");
    });
  });

  // -----------------------------------------------
  // uploadDocument
  // -----------------------------------------------
  describe("uploadDocument", () => {
    const mockFile = new File(["test"], "doc.jpg", { type: "image/jpeg" });

    beforeEach(() => {
      mockEnrollmentRepo.findById.mockResolvedValue(mockApplication);
      mockSaveUploadedFile.mockResolvedValue("/home/ubuntu/uploads/id-documents/uuid.jpg");
      mockEnrollmentRepo.update.mockResolvedValue({
        ...mockApplication,
        idDocumentPath: "/home/ubuntu/uploads/id-documents/uuid.jpg",
      });
    });

    it("test_uploadDocument_valid_id_document_saves_path", async () => {
      const result = await service.uploadDocument("app-1", "idDocument", mockFile);

      expect(result.idDocumentPath).toBe("/home/ubuntu/uploads/id-documents/uuid.jpg");
    });

    it("test_uploadDocument_valid_photo_saves_path", async () => {
      mockSaveUploadedFile.mockResolvedValue("/home/ubuntu/uploads/photos/uuid.jpg");
      mockEnrollmentRepo.update.mockResolvedValue({
        ...mockApplication,
        photoPath: "/home/ubuntu/uploads/photos/uuid.jpg",
      });

      const result = await service.uploadDocument("app-1", "photo", mockFile);

      expect(result.photoPath).toBe("/home/ubuntu/uploads/photos/uuid.jpg");
    });

    it("test_uploadDocument_experience_cert_saves_path", async () => {
      mockSaveUploadedFile.mockResolvedValue("/home/ubuntu/uploads/experience-certs/uuid.pdf");
      mockEnrollmentRepo.update.mockResolvedValue({
        ...mockApplication,
        experienceCertPath: "/home/ubuntu/uploads/experience-certs/uuid.pdf",
      });

      const result = await service.uploadDocument("app-1", "experienceCert", mockFile);

      expect(result.experienceCertPath).toBe("/home/ubuntu/uploads/experience-certs/uuid.pdf");
    });

    it("test_uploadDocument_nonexistent_application_throws_error", async () => {
      mockEnrollmentRepo.findById.mockResolvedValue(null);

      await expect(
        service.uploadDocument("nonexistent", "idDocument", mockFile)
      ).rejects.toThrow(EnrollmentNotFoundError);
    });

    it("test_uploadDocument_calls_saveUploadedFile_with_correct_subdirectory", async () => {
      await service.uploadDocument("app-1", "idDocument", mockFile);

      expect(mockSaveUploadedFile).toHaveBeenCalledWith(mockFile, "id-documents");
    });
  });

  // -----------------------------------------------
  // acceptEnrollment
  // -----------------------------------------------
  describe("acceptEnrollment", () => {
    it("test_acceptEnrollment_sets_acceptedAt", async () => {
      mockEnrollmentRepo.findById.mockResolvedValue(mockApplication);
      const acceptedApp = { ...mockApplication, acceptedAt: new Date() };
      mockEnrollmentRepo.update.mockResolvedValue(acceptedApp);

      const result = await service.acceptEnrollment("app-1");

      expect(result.acceptedAt).not.toBeNull();
      expect(mockEnrollmentRepo.update).toHaveBeenCalledWith(
        "app-1",
        expect.objectContaining({ acceptedAt: expect.any(Date) })
      );
    });

    it("test_acceptEnrollment_nonexistent_application_throws_error", async () => {
      mockEnrollmentRepo.findById.mockResolvedValue(null);

      await expect(service.acceptEnrollment("nonexistent")).rejects.toThrow(
        EnrollmentNotFoundError
      );
    });
  });
});
