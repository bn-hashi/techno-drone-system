import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { ICompletionCertificateRepository } from "@/repositories/completionCertificateRepository";
import type { IEnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import { UserStatus, CourseType, UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

// emailService をモック
vi.mock("@/services/emailService", () => ({
  sendCertificateIssuedEmail: vi.fn(),
}));

// runTransaction を pass-through でモック
vi.mock("@/lib/db", () => ({
  runTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({} as never)),
}));

import * as emailServiceModule from "@/services/emailService";
import { CertificateService } from "@/services/certificateService";
import type {
  UserManagementServiceLikeForCertificate,
  CertificatePdfGenerator,
  CertificateFileWriter,
} from "@/services/certificateService";

describe("CertificateService", () => {
  let service: CertificateService;
  let mockCertRepo: ICompletionCertificateRepository;
  let mockEnrollmentRepo: IEnrollmentApplicationRepository;
  let mockUserManagementService: UserManagementServiceLikeForCertificate;
  let mockPdfGenerator: CertificatePdfGenerator;
  let mockFileWriter: CertificateFileWriter;

  const userId = "user-1";

  const completedUser = {
    id: userId,
    email: "student@example.com",
    name: "山田 花子",
    role: UserRole.STUDENT,
    status: UserStatus.COMPLETED,
    courseType: CourseType.BEGINNER,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const examPassedUser = { ...completedUser, status: UserStatus.EXAM_PASSED };

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
    applicantNumber: "T-12345678",
    acceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCertificate = {
    id: "cert-1",
    userId,
    certificateNumber: "第TC051526050001号",
    issuedAt: new Date("2026-05-26T01:00:00Z"),
    expiresAt: new Date("2027-05-25T15:00:00Z"),
    pdfPath: null,
  };

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
    mockUserManagementService = {
      getUserById: vi.fn(),
      updateStatus: vi.fn(),
    };
    mockPdfGenerator = {
      generate: vi.fn(),
    };
    mockFileWriter = {
      write: vi.fn(),
    };

    vi.mocked(emailServiceModule.sendCertificateIssuedEmail).mockReset();
    service = new CertificateService(
      mockCertRepo,
      mockEnrollmentRepo,
      mockUserManagementService,
      mockPdfGenerator,
      mockFileWriter
    );
  });

  describe("getCertificateData", () => {
    it("test_getCertificateData_returns_certificate_when_issued", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(completedUser);
      vi.mocked(mockCertRepo.findByUser).mockResolvedValue(mockCertificate);

      // Act
      const result = await service.getCertificateData(userId);

      // Assert
      expect(result.certificate).toEqual(mockCertificate);
    });

    it("test_getCertificateData_returns_null_certificate_when_not_issued", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(completedUser);
      vi.mocked(mockCertRepo.findByUser).mockResolvedValue(null);

      // Act
      const result = await service.getCertificateData(userId);

      // Assert
      expect(result.certificate).toBeNull();
    });

    it("test_getCertificateData_returns_user", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(completedUser);
      vi.mocked(mockCertRepo.findByUser).mockResolvedValue(null);

      // Act
      const result = await service.getCertificateData(userId);

      // Assert
      expect(result.user).toEqual(completedUser);
    });

    it("test_getCertificateData_returns_canIssue_true_for_COMPLETED_without_certificate", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(completedUser);
      vi.mocked(mockCertRepo.findByUser).mockResolvedValue(null);

      // Act
      const result = await service.getCertificateData(userId);

      // Assert
      expect(result.canIssue).toBe(true);
    });

    it("test_getCertificateData_returns_canIssue_false_when_already_issued", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(completedUser);
      vi.mocked(mockCertRepo.findByUser).mockResolvedValue(mockCertificate);

      // Act
      const result = await service.getCertificateData(userId);

      // Assert
      expect(result.canIssue).toBe(false);
    });

    it("test_getCertificateData_returns_canIssue_false_for_non_completed_status", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);
      vi.mocked(mockCertRepo.findByUser).mockResolvedValue(null);

      // Act
      const result = await service.getCertificateData(userId);

      // Assert
      expect(result.canIssue).toBe(false);
    });

    it("test_getCertificateData_nonexistent_user_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCertificateData("user-x")).rejects.toThrow(BusinessError);
    });
  });

  describe("issueCertificate", () => {
    const arrangeIssueScenario = () => {
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(completedUser);
      vi.mocked(mockCertRepo.findByUser).mockResolvedValue(null);
      vi.mocked(mockEnrollmentRepo.findByUserId).mockResolvedValue(mockEnrollment);
      vi.mocked(mockCertRepo.countByMonth).mockResolvedValue(0); // 当月初の発行 → sequence=1
      vi.mocked(mockCertRepo.create).mockResolvedValue(mockCertificate);
      vi.mocked(mockUserManagementService.updateStatus).mockResolvedValue(completedUser);
      vi.mocked(mockPdfGenerator.generate).mockResolvedValue(Buffer.from("PDF"));
      vi.mocked(mockFileWriter.write).mockResolvedValue("/path/cert-1.pdf");
      vi.mocked(mockCertRepo.updatePdfPath).mockResolvedValue({
        ...mockCertificate,
        pdfPath: "/path/cert-1.pdf",
      });
      vi.mocked(emailServiceModule.sendCertificateIssuedEmail).mockResolvedValue(undefined);
    };

    it("test_issueCertificate_returns_certificate", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      const result = await service.issueCertificate(userId);

      // Assert
      expect(result.certificate.id).toBe("cert-1");
    });

    it("test_issueCertificate_returns_pdfGenerated_true_on_success", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      const result = await service.issueCertificate(userId);

      // Assert
      expect(result.pdfGenerated).toBe(true);
    });

    it("test_issueCertificate_returns_mailSent_true_on_success", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      const result = await service.issueCertificate(userId);

      // Assert
      expect(result.mailSent).toBe(true);
    });

    it("test_issueCertificate_calls_countByMonth", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      await service.issueCertificate(userId);

      // Assert
      expect(mockCertRepo.countByMonth).toHaveBeenCalled();
    });

    it("test_issueCertificate_countByMonth_year_arg_is_number", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      await service.issueCertificate(userId);

      // Assert: JST 計算は certificateNumbering 側に任せ、引数が number であることだけ検証
      const callArgs = vi.mocked(mockCertRepo.countByMonth).mock.calls[0];
      expect(typeof callArgs[0]).toBe("number");
    });

    it("test_issueCertificate_countByMonth_month_arg_is_number", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      await service.issueCertificate(userId);

      // Assert
      const callArgs = vi.mocked(mockCertRepo.countByMonth).mock.calls[0];
      expect(typeof callArgs[1]).toBe("number");
    });

    it("test_issueCertificate_creates_certificate_with_sequence_1_when_count_is_0", async () => {
      // Arrange
      arrangeIssueScenario();
      vi.mocked(mockCertRepo.countByMonth).mockResolvedValue(0);

      // Act
      await service.issueCertificate(userId);

      // Assert
      const createArgs = vi.mocked(mockCertRepo.create).mock.calls[0][0];
      // 番号末尾は 0001 (sequence=1)
      expect(createArgs.certificateNumber).toMatch(/0001号$/);
    });

    it("test_issueCertificate_creates_certificate_with_sequence_6_when_count_is_5", async () => {
      // Arrange
      arrangeIssueScenario();
      vi.mocked(mockCertRepo.countByMonth).mockResolvedValue(5);

      // Act
      await service.issueCertificate(userId);

      // Assert
      const createArgs = vi.mocked(mockCertRepo.create).mock.calls[0][0];
      expect(createArgs.certificateNumber).toMatch(/0006号$/);
    });

    it("test_issueCertificate_transitions_status_to_CERTIFIED", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      await service.issueCertificate(userId);

      // Assert
      expect(mockUserManagementService.updateStatus).toHaveBeenCalledWith(
        userId,
        UserStatus.CERTIFIED,
        expect.anything()
      );
    });

    it("test_issueCertificate_writes_pdf_file", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      await service.issueCertificate(userId);

      // Assert
      expect(mockFileWriter.write).toHaveBeenCalled();
    });

    it("test_issueCertificate_updates_pdfPath_after_write", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      await service.issueCertificate(userId);

      // Assert
      expect(mockCertRepo.updatePdfPath).toHaveBeenCalledWith("cert-1", "/path/cert-1.pdf");
    });

    it("test_issueCertificate_sends_email_to_user", async () => {
      // Arrange
      arrangeIssueScenario();

      // Act
      await service.issueCertificate(userId);

      // Assert
      expect(emailServiceModule.sendCertificateIssuedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "student@example.com",
          studentName: "山田 花子",
        })
      );
    });

    it("test_issueCertificate_non_completed_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(examPassedUser);

      // Act & Assert
      await expect(service.issueCertificate(userId)).rejects.toThrow(BusinessError);
    });

    it("test_issueCertificate_already_issued_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(completedUser);
      vi.mocked(mockCertRepo.findByUser).mockResolvedValue(mockCertificate);

      // Act & Assert
      await expect(service.issueCertificate(userId)).rejects.toThrow(BusinessError);
    });

    it("test_issueCertificate_nonexistent_user_throws_BusinessError", async () => {
      // Arrange
      vi.mocked(mockUserManagementService.getUserById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.issueCertificate("user-x")).rejects.toThrow(BusinessError);
    });

    it("test_issueCertificate_pdf_failure_returns_pdfGenerated_false", async () => {
      // Arrange
      arrangeIssueScenario();
      vi.mocked(mockPdfGenerator.generate).mockRejectedValue(new Error("PDF render failed"));

      // Act
      const result = await service.issueCertificate(userId);

      // Assert
      expect(result.pdfGenerated).toBe(false);
    });

    it("test_issueCertificate_pdf_failure_still_returns_certificate", async () => {
      // Arrange
      arrangeIssueScenario();
      vi.mocked(mockPdfGenerator.generate).mockRejectedValue(new Error("PDF render failed"));

      // Act
      const result = await service.issueCertificate(userId);

      // Assert
      expect(result.certificate.id).toBe("cert-1");
    });

    it("test_issueCertificate_email_failure_returns_mailSent_false", async () => {
      // Arrange
      arrangeIssueScenario();
      vi.mocked(emailServiceModule.sendCertificateIssuedEmail).mockRejectedValue(
        new Error("Email failed")
      );

      // Act
      const result = await service.issueCertificate(userId);

      // Assert
      expect(result.mailSent).toBe(false);
    });

    it("test_issueCertificate_no_enrollment_uses_unset_applicant_number", async () => {
      // Arrange
      arrangeIssueScenario();
      vi.mocked(mockEnrollmentRepo.findByUserId).mockResolvedValue(null);

      // Act
      await service.issueCertificate(userId);

      // Assert
      const pdfArgs = vi.mocked(mockPdfGenerator.generate).mock.calls[0][0];
      expect(pdfArgs.applicantNumber).toBe("未設定");
    });

    it("test_issueCertificate_null_applicant_number_uses_unset", async () => {
      // Arrange
      arrangeIssueScenario();
      vi.mocked(mockEnrollmentRepo.findByUserId).mockResolvedValue({
        ...mockEnrollment,
        applicantNumber: null,
      });

      // Act
      await service.issueCertificate(userId);

      // Assert
      const pdfArgs = vi.mocked(mockPdfGenerator.generate).mock.calls[0][0];
      expect(pdfArgs.applicantNumber).toBe("未設定");
    });

    it("test_issueCertificate_unique_conflict_throws_BusinessError", async () => {
      // Arrange: 並行発行で UNIQUE 違反が起きるケース
      arrangeIssueScenario();
      const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
      vi.mocked(mockCertRepo.create).mockRejectedValue(p2002);

      // Act & Assert
      await expect(service.issueCertificate(userId)).rejects.toThrow(BusinessError);
    });

    it("test_issueCertificate_unique_conflict_message_indicates_already_issued", async () => {
      // Arrange
      arrangeIssueScenario();
      const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
      vi.mocked(mockCertRepo.create).mockRejectedValue(p2002);

      // Act & Assert
      await expect(service.issueCertificate(userId)).rejects.toThrow(
        "この受講者には既に修了証明書が発行されています"
      );
    });

    it("test_issueCertificate_returns_certificate_with_pdfPath_after_write_success", async () => {
      // Arrange: updatePdfPath が返した最新の certificate がレスポンスに反映されること
      arrangeIssueScenario();

      // Act
      const result = await service.issueCertificate(userId);

      // Assert
      expect(result.certificate.pdfPath).toBe("/path/cert-1.pdf");
    });

    it("test_issueCertificate_uses_env_examiner_name", async () => {
      // Arrange
      arrangeIssueScenario();
      const originalEnv = process.env.EXAMINER_NAME;
      process.env.EXAMINER_NAME = "鈴木 一郎";

      try {
        // Act
        await service.issueCertificate(userId);

        // Assert
        const pdfArgs = vi.mocked(mockPdfGenerator.generate).mock.calls[0][0];
        expect(pdfArgs.examinerName).toBe("鈴木 一郎");
      } finally {
        if (originalEnv !== undefined) {
          process.env.EXAMINER_NAME = originalEnv;
        } else {
          delete process.env.EXAMINER_NAME;
        }
      }
    });
  });
});
