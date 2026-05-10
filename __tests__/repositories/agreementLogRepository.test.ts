import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgreementLogRepository } from "@/repositories/agreementLogRepository";

const mockCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    agreementLog: {
      create: mockCreate,
    },
    user: {
      update: mockUserUpdate,
    },
    $transaction: mockTransaction,
  }),
}));

describe("AgreementLogRepository", () => {
  let repository: AgreementLogRepository;

  const mockAgreementLog = {
    id: "log-1",
    userId: "user-1",
    version: "1.0",
    agreedAt: new Date("2024-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    mockCreate.mockReset();
    mockUserUpdate.mockReset();
    mockTransaction.mockReset();
    repository = new AgreementLogRepository();
  });

  describe("create", () => {
    it("test_create_valid_data_returns_agreement_log", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      const input = {
        userId: "user-1",
        agreedAt: new Date("2024-01-01T00:00:00Z"),
        ipAddress: "192.168.1.1",
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result).toEqual(mockAgreementLog);
    });

    it("test_create_valid_data_calls_prisma_create_once", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      const input = {
        userId: "user-1",
        agreedAt: new Date("2024-01-01T00:00:00Z"),
        ipAddress: "192.168.1.1",
      };

      // Act
      await repository.create(input);

      // Assert
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it("test_create_valid_data_calls_prisma_create_with_correct_userId", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      const input = {
        userId: "user-1",
        agreedAt: new Date("2024-01-01T00:00:00Z"),
        ipAddress: "192.168.1.1",
      };

      // Act
      await repository.create(input);

      // Assert
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.userId).toBe("user-1");
    });

    it("test_create_valid_data_calls_prisma_create_with_agreedAt", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      const agreedAt = new Date("2024-06-15T10:00:00Z");
      const input = {
        userId: "user-1",
        agreedAt,
        ipAddress: "10.0.0.1",
      };

      // Act
      await repository.create(input);

      // Assert
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.agreedAt).toEqual(agreedAt);
    });

    it("test_create_valid_data_sets_version_field", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      const input = {
        userId: "user-1",
        agreedAt: new Date(),
        ipAddress: "127.0.0.1",
      };

      // Act
      await repository.create(input);

      // Assert - version フィールドが設定されていること
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.version).toBeDefined();
    });

    it("test_create_prisma_error_propagates", async () => {
      // Arrange
      mockCreate.mockRejectedValue(new Error("DB connection error"));
      const input = {
        userId: "user-1",
        agreedAt: new Date(),
        ipAddress: "127.0.0.1",
      };

      // Act & Assert
      await expect(repository.create(input)).rejects.toThrow("DB connection error");
    });
  });

  describe("createAndActivateUser", () => {
    const input = {
      userId: "user-1",
      agreedAt: new Date("2024-01-01T00:00:00Z"),
      ipAddress: "192.168.1.1",
    };

    it("test_createAndActivateUser_returns_agreement_log", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      mockUserUpdate.mockResolvedValue({ id: "user-1" });
      mockTransaction.mockImplementation(async (promises: Promise<unknown>[]) =>
        Promise.all(promises)
      );

      // Act
      const result = await repository.createAndActivateUser(input);

      // Assert
      expect(result).toEqual(mockAgreementLog);
    });

    it("test_createAndActivateUser_calls_transaction_once", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      mockUserUpdate.mockResolvedValue({ id: "user-1" });
      mockTransaction.mockImplementation(async (promises: Promise<unknown>[]) =>
        Promise.all(promises)
      );

      // Act
      await repository.createAndActivateUser(input);

      // Assert
      expect(mockTransaction).toHaveBeenCalledOnce();
    });

    it("test_createAndActivateUser_calls_agreementLog_create_with_correct_userId", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      mockUserUpdate.mockResolvedValue({ id: "user-1" });
      mockTransaction.mockImplementation(async (promises: Promise<unknown>[]) =>
        Promise.all(promises)
      );

      // Act
      await repository.createAndActivateUser(input);

      // Assert
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.userId).toBe("user-1");
    });

    it("test_createAndActivateUser_calls_user_update_with_correct_userId", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      mockUserUpdate.mockResolvedValue({ id: "user-1" });
      mockTransaction.mockImplementation(async (promises: Promise<unknown>[]) =>
        Promise.all(promises)
      );

      // Act
      await repository.createAndActivateUser(input);

      // Assert
      const updateArgs = mockUserUpdate.mock.calls[0][0];
      expect(updateArgs.where.id).toBe("user-1");
    });

    it("test_createAndActivateUser_transaction_error_propagates", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockAgreementLog);
      mockUserUpdate.mockResolvedValue({ id: "user-1" });
      mockTransaction.mockRejectedValue(new Error("Transaction failed"));

      // Act & Assert
      await expect(repository.createAndActivateUser(input)).rejects.toThrow("Transaction failed");
    });
  });
});
