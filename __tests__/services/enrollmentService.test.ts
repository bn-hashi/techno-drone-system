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

    it("test_createEnrollment_future_dateOfBirth_throws_validation_error", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await expect(
        service.createEnrollment({ ...createInput, dateOfBirth: futureDate })
      ).rejects.toThrow(BusinessError);
      await expect(
        service.createEnrollment({ ...createInput, dateOfBirth: futureDate })
      ).rejects.toThrow("生年月日に未来の日付は使用できません");
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
      mockUserRepo.updateStatus.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACTIVATION } as never);

      const result = await service.acceptEnrollment("app-1");

      expect(result.acceptedAt).not.toBeNull();
      expect(mockEnrollmentRepo.update).toHaveBeenCalledWith(
        "app-1",
        expect.objectContaining({ acceptedAt: expect.any(Date) })
      );
    });

    it("test_acceptEnrollment_updates_user_status_to_pending_activation", async () => {
      mockEnrollmentRepo.findById.mockResolvedValue(mockApplication);
      mockEnrollmentRepo.update.mockResolvedValue({ ...mockApplication, acceptedAt: new Date() });
      mockUserRepo.updateStatus.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACTIVATION } as never);

      await service.acceptEnrollment("app-1");

      expect(mockUserRepo.updateStatus).toHaveBeenCalledWith(
        "user-1",
        UserStatus.PENDING_ACTIVATION
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
