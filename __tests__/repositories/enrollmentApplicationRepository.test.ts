import { describe, it, expect, beforeEach, vi } from "vitest";
import { EnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import { UserStatus } from "@/types/prisma";

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockUserUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    enrollmentApplication: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
    user: {
      update: mockUserUpdate,
    },
    $transaction: mockTransaction,
  }),
}));

describe("EnrollmentApplicationRepository", () => {
  let repository: EnrollmentApplicationRepository;

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

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockUserUpdate.mockReset();
    mockTransaction.mockReset();
    // $transaction はオペレーション配列を受け取り Promise.all で解決する
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    repository = new EnrollmentApplicationRepository();
  });

  describe("findByUserId", () => {
    it("test_findByUserId_existing_user_returns_application", async () => {
      mockFindUnique.mockResolvedValue(mockApplication);

      const result = await repository.findByUserId("user-1");

      expect(result).toEqual(mockApplication);
    });

    it("test_findByUserId_nonexistent_user_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findByUserId("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findById", () => {
    it("test_findById_existing_id_returns_application", async () => {
      mockFindUnique.mockResolvedValue(mockApplication);

      const result = await repository.findById("app-1");

      expect(result).toEqual(mockApplication);
    });

    it("test_findById_nonexistent_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    const createInput = {
      userId: "user-1",
      dateOfBirth: new Date("1990-01-15"),
      address: "東京都千代田区1-1-1",
      phoneNumber: "090-1234-5678",
    };

    it("test_create_valid_data_returns_created_application", async () => {
      mockCreate.mockResolvedValue(mockApplication);

      const result = await repository.create(createInput);

      expect(result).toEqual(mockApplication);
    });

    it("test_create_valid_data_calls_prisma_create_with_data", async () => {
      mockCreate.mockResolvedValue(mockApplication);

      await repository.create(createInput);

      expect(mockCreate).toHaveBeenCalledWith({ data: createInput });
    });
  });

  describe("update", () => {
    it("test_update_existing_application_returns_updated_data", async () => {
      const updated = { ...mockApplication, idDocumentPath: "/uploads/id-doc.jpg" };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.update("app-1", {
        idDocumentPath: "/uploads/id-doc.jpg",
      });

      expect(result).toEqual(updated);
    });

    it("test_update_calls_prisma_update_with_correct_args", async () => {
      mockUpdate.mockResolvedValue(mockApplication);

      await repository.update("app-1", { photoPath: "/uploads/photo.jpg" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: { photoPath: "/uploads/photo.jpg" },
      });
    });
  });

  describe("accept", () => {
    const acceptedApp = { ...mockApplication, acceptedAt: new Date() };
    const mockUserRecord = { id: "user-1", status: UserStatus.PENDING_ACTIVATION };

    beforeEach(() => {
      mockUpdate.mockResolvedValue(acceptedApp);
      mockUserUpdate.mockResolvedValue(mockUserRecord);
    });

    it("test_accept_valid_ids_returns_accepted_application", async () => {
      const result = await repository.accept("app-1", "user-1");

      expect(result).toEqual(acceptedApp);
    });

    it("test_accept_valid_ids_calls_enrollment_update_with_acceptedAt", async () => {
      await repository.accept("app-1", "user-1");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: { acceptedAt: expect.any(Date) },
      });
    });

    it("test_accept_valid_ids_calls_user_update_with_pending_activation", async () => {
      await repository.accept("app-1", "user-1");

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { status: UserStatus.PENDING_ACTIVATION },
      });
    });
  });
});
