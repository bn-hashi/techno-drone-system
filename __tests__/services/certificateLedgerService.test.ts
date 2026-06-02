import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ICompletionCertificateRepository } from "@/repositories/completionCertificateRepository";
import type { IEnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import { UserStatus, CourseType, UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";
import { CertificateLedgerService } from "@/services/certificateLedgerService";
import type {
  CertificateLedgerPdfGenerator,
  UserLookupForLedger,
} from "@/services/certificateLedgerService";

describe("CertificateLedgerService", () => {
  let service: CertificateLedgerService;
  let mockCertRepo: ICompletionCertificateRepository;
  let mockEnrollmentRepo: IEnrollmentApplicationRepository;
  let mockUserLookup: UserLookupForLedger;
  let mockLedgerGenerator: CertificateLedgerPdfGenerator;

  const userId = "user-1";

  const certifiedUser = {
    id: userId,
    email: "student@example.com",
    name: "高蜂 賢治",
    role: UserRole.STUDENT,
    status: UserStatus.CERTIFIED,
    courseType: CourseType.BEGINNER,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEnrollment = {
    id: "app-1",
    userId,
    applicationDate: new Date(),
    dateOfBirth: new Date("1990-01-15"),
    address: "東京都...",
    phoneNumber: "090-...",
    idDocumentPath: null,
    photoPath: null,
    experienceCertPath: null,
    applicantNumber: "2407012367",
    acceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCertificate = {
    id: "cert-1",
    userId,
    certificateNumber: "第TC051524091142号",
    issuedAt: new Date("2024-09-24T15:00:00Z"),
    expiresAt: new Date("2025-09-23T15:00:00Z"),
    pdfPath: "/uploads/certificates/TC051524091142.pdf",
  };

  const fakePdf = Buffer.from("LEDGER-PDF-BYTES");

  beforeEach(() => {
    mockCertRepo = {
      findByUser: vi.fn(),
      findByNumber: vi.fn(),
      countByMonth: vi.fn(),
      create: vi.fn(),
      updatePdfPath: vi.fn(),
    };
    mockEnrollmentRepo = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      accept: vi.fn(),
    } as unknown as IEnrollmentApplicationRepository;
    mockUserLookup = {
      getUserById: vi.fn(),
    };
    mockLedgerGenerator = {
      generate: vi.fn(),
    };
    service = new CertificateLedgerService(
      mockCertRepo,
      mockEnrollmentRepo,
      mockUserLookup,
      mockLedgerGenerator
    );
  });

  it("test_getLedgerPdf_returns_buffer_when_certificate_issued", async () => {
    // Arrange
    vi.mocked(mockUserLookup.getUserById).mockResolvedValue(certifiedUser);
    vi.mocked(mockCertRepo.findByUser).mockResolvedValue(mockCertificate);
    vi.mocked(mockEnrollmentRepo.findByUserId).mockResolvedValue(mockEnrollment);
    vi.mocked(mockLedgerGenerator.generate).mockResolvedValue(fakePdf);

    // Act
    const result = await service.getLedgerPdf(userId);

    // Assert
    expect(result).toBe(fakePdf);
  });

  it("test_getLedgerPdf_throws_when_user_not_found", async () => {
    // Arrange
    vi.mocked(mockUserLookup.getUserById).mockResolvedValue(null);

    // Act & Assert
    await expect(service.getLedgerPdf(userId)).rejects.toThrow(BusinessError);
  });

  it("test_getLedgerPdf_throws_when_certificate_not_issued", async () => {
    // Arrange
    vi.mocked(mockUserLookup.getUserById).mockResolvedValue(certifiedUser);
    vi.mocked(mockCertRepo.findByUser).mockResolvedValue(null);

    // Act & Assert
    await expect(service.getLedgerPdf(userId)).rejects.toThrow(BusinessError);
  });

  it("test_getLedgerPdf_passes_certificate_number_to_generator", async () => {
    // Arrange
    vi.mocked(mockUserLookup.getUserById).mockResolvedValue(certifiedUser);
    vi.mocked(mockCertRepo.findByUser).mockResolvedValue(mockCertificate);
    vi.mocked(mockEnrollmentRepo.findByUserId).mockResolvedValue(mockEnrollment);
    vi.mocked(mockLedgerGenerator.generate).mockResolvedValue(fakePdf);

    // Act
    await service.getLedgerPdf(userId);

    // Assert
    expect(vi.mocked(mockLedgerGenerator.generate).mock.calls[0][0].certificateNumber).toBe(
      "第TC051524091142号"
    );
  });

  it("test_getLedgerPdf_uses_applicant_number_from_enrollment", async () => {
    // Arrange
    vi.mocked(mockUserLookup.getUserById).mockResolvedValue(certifiedUser);
    vi.mocked(mockCertRepo.findByUser).mockResolvedValue(mockCertificate);
    vi.mocked(mockEnrollmentRepo.findByUserId).mockResolvedValue(mockEnrollment);
    vi.mocked(mockLedgerGenerator.generate).mockResolvedValue(fakePdf);

    // Act
    await service.getLedgerPdf(userId);

    // Assert
    expect(vi.mocked(mockLedgerGenerator.generate).mock.calls[0][0].applicantNumber).toBe(
      "2407012367"
    );
  });

  it("test_getLedgerPdf_defaults_applicant_number_when_enrollment_missing", async () => {
    // Arrange
    vi.mocked(mockUserLookup.getUserById).mockResolvedValue(certifiedUser);
    vi.mocked(mockCertRepo.findByUser).mockResolvedValue(mockCertificate);
    vi.mocked(mockEnrollmentRepo.findByUserId).mockResolvedValue(null);
    vi.mocked(mockLedgerGenerator.generate).mockResolvedValue(fakePdf);

    // Act
    await service.getLedgerPdf(userId);

    // Assert
    expect(vi.mocked(mockLedgerGenerator.generate).mock.calls[0][0].applicantNumber).toBe("未設定");
  });
});
