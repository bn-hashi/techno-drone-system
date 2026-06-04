import { describe, it, expect, beforeEach, vi } from "vitest";
import { CompletionCertificateRepository } from "@/repositories/completionCertificateRepository";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    completionCertificate: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      count: mockCount,
      create: mockCreate,
      update: mockUpdate,
    },
  }),
}));

describe("CompletionCertificateRepository", () => {
  let repository: CompletionCertificateRepository;

  const issuedAt = new Date("2026-05-26T01:00:00Z");
  const expiresAt = new Date("2027-05-25T23:59:59Z");

  const mockCertificate = {
    id: "cert-1",
    userId: "user-1",
    certificateNumber: "第TC051526050001号",
    issuedAt,
    expiresAt,
    pdfPath: null,
  };

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindFirst.mockReset();
    mockCount.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    repository = new CompletionCertificateRepository();
  });

  describe("findByUser", () => {
    it("test_findByUser_existing_returns_certificate", async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockCertificate);

      // Act
      const result = await repository.findByUser("user-1");

      // Assert
      expect(result).toEqual(mockCertificate);
    });

    it("test_findByUser_calls_prisma_with_userId", async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(null);

      // Act
      await repository.findByUser("user-1");

      // Assert
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });

    it("test_findByUser_nonexistent_returns_null", async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findByUser("user-x");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findByNumber", () => {
    it("test_findByNumber_existing_returns_certificate", async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockCertificate);

      // Act
      const result = await repository.findByNumber("第TC051526050001号");

      // Assert
      expect(result).toEqual(mockCertificate);
    });

    it("test_findByNumber_calls_prisma_with_certificateNumber", async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(null);

      // Act
      await repository.findByNumber("第TC051526050001号");

      // Assert
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { certificateNumber: "第TC051526050001号" },
      });
    });
  });

  describe("countByMonth", () => {
    it("test_countByMonth_returns_count", async () => {
      // Arrange
      mockCount.mockResolvedValue(5);

      // Act
      const result = await repository.countByMonth(2026, 5);

      // Assert
      expect(result).toBe(5);
    });

    it("test_countByMonth_uses_JST_range_gte", async () => {
      // 2026/05 (JST) の月初は UTC で 2026-04-30T15:00:00Z
      mockCount.mockResolvedValue(0);

      await repository.countByMonth(2026, 5);

      const callArgs = mockCount.mock.calls[0][0];
      expect(callArgs.where.issuedAt.gte).toEqual(new Date("2026-04-30T15:00:00.000Z"));
    });

    it("test_countByMonth_uses_JST_range_lt", async () => {
      // 2026/05 (JST) の翌月初は UTC で 2026-05-31T15:00:00Z
      mockCount.mockResolvedValue(0);

      await repository.countByMonth(2026, 5);

      const callArgs = mockCount.mock.calls[0][0];
      expect(callArgs.where.issuedAt.lt).toEqual(new Date("2026-05-31T15:00:00.000Z"));
    });

    it("test_countByMonth_december_year_boundary_gte", async () => {
      // 2026/12 (JST) の月初は UTC で 2026-11-30T15:00:00Z
      mockCount.mockResolvedValue(0);

      await repository.countByMonth(2026, 12);

      const callArgs = mockCount.mock.calls[0][0];
      expect(callArgs.where.issuedAt.gte).toEqual(new Date("2026-11-30T15:00:00.000Z"));
    });

    it("test_countByMonth_december_year_boundary_lt", async () => {
      // 2026/12 (JST) の翌月初は UTC で 2026-12-31T15:00:00Z (2027/01 切り替え)
      mockCount.mockResolvedValue(0);

      await repository.countByMonth(2026, 12);

      const callArgs = mockCount.mock.calls[0][0];
      expect(callArgs.where.issuedAt.lt).toEqual(new Date("2026-12-31T15:00:00.000Z"));
    });

    it("test_countByMonth_month_zero_throws_RangeError", async () => {
      await expect(repository.countByMonth(2026, 0)).rejects.toThrow(RangeError);
    });

    it("test_countByMonth_month_13_throws_RangeError", async () => {
      await expect(repository.countByMonth(2026, 13)).rejects.toThrow(RangeError);
    });

    it("test_countByMonth_negative_month_throws_RangeError", async () => {
      await expect(repository.countByMonth(2026, -1)).rejects.toThrow(RangeError);
    });

    it("test_countByMonth_fractional_month_throws_RangeError", async () => {
      await expect(repository.countByMonth(2026, 1.5)).rejects.toThrow(RangeError);
    });
  });

  describe("create", () => {
    it("test_create_returns_persisted_certificate", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockCertificate);

      // Act
      const result = await repository.create({
        userId: "user-1",
        certificateNumber: "第TC051526050001号",
        issuedAt,
        expiresAt,
      });

      // Assert
      expect(result).toEqual(mockCertificate);
    });

    it("test_create_calls_prisma_with_data", async () => {
      // Arrange
      mockCreate.mockResolvedValue(mockCertificate);

      // Act
      await repository.create({
        userId: "user-1",
        certificateNumber: "第TC051526050001号",
        issuedAt,
        expiresAt,
      });

      // Assert
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          certificateNumber: "第TC051526050001号",
          issuedAt,
          expiresAt,
        },
      });
    });

    it("test_create_with_tx_uses_tx", async () => {
      // Arrange
      const txCreate = vi.fn().mockResolvedValue(mockCertificate);
      const txClient = { completionCertificate: { create: txCreate } };

      // Act
      await repository.create(
        {
          userId: "user-1",
          certificateNumber: "第TC051526050001号",
          issuedAt,
          expiresAt,
        },
        txClient as never
      );

      // Assert
      expect(txCreate).toHaveBeenCalledOnce();
    });
  });

  describe("updatePdfPath", () => {
    it("test_updatePdfPath_returns_updated_certificate", async () => {
      // Arrange
      const updated = { ...mockCertificate, pdfPath: "/certs/cert-1.pdf" };
      mockUpdate.mockResolvedValue(updated);

      // Act
      const result = await repository.updatePdfPath("cert-1", "/certs/cert-1.pdf");

      // Assert
      expect(result).toEqual(updated);
    });

    it("test_updatePdfPath_calls_prisma_with_id_and_path", async () => {
      // Arrange
      mockUpdate.mockResolvedValue(mockCertificate);

      // Act
      await repository.updatePdfPath("cert-1", "/certs/cert-1.pdf");

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "cert-1" },
        data: { pdfPath: "/certs/cert-1.pdf" },
      });
    });
  });
});
