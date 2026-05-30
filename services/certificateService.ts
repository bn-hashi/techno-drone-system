import type { CompletionCertificate, Prisma } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";
import type {
  ICompletionCertificateRepository,
  CreateCompletionCertificateInput,
} from "@/repositories/completionCertificateRepository";
import type { IEnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import type { SafeUser } from "@/services/userManagementService";
import { getPrisma } from "@/lib/db";
import { sendCertificateIssuedEmail } from "@/services/emailService";
import { BusinessError } from "@/services/errors";
import { UserStatus } from "@/types/prisma";
import { logger } from "@/lib/logger";
import { formatCertificateNumber, calculateExpiryDate } from "@/lib/certificateNumbering";
import {
  INSTITUTION_CODE,
  INSTITUTION_NAME,
  SCHOOL_NAME,
  TRAINING_OFFICE_CODE,
  DEFAULT_EXAMINER_NAME,
} from "@/lib/constants";

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

/** CertificateService が依存する UserManagementService の最小契約 */
export interface UserManagementServiceLikeForCertificate {
  getUserById(id: string): Promise<SafeUser | null>;
  updateStatus(userId: string, newStatus: UserStatus, tx?: PrismaLike): Promise<SafeUser>;
}

/** PDF 生成の抽象 (依存注入でテストしやすくする) */
export interface CertificatePdfInput {
  certificateNumber: string;
  studentName: string;
  applicantNumber: string;
  examinerName: string;
  issuedAt: Date;
  expiresAt: Date;
  institutionName: string;
  institutionCode: string;
  schoolName: string;
  trainingOfficeCode: string;
}

export interface CertificatePdfGenerator {
  generate(input: CertificatePdfInput): Promise<Buffer>;
}

/** PDF ファイル書き込みの抽象 */
export interface CertificateFileWriter {
  /** 与えられた証明書番号と Buffer を保存し、保存後の絶対パスを返す */
  write(certificateNumber: string, buffer: Buffer): Promise<string>;
}

export interface CertificateView {
  user: SafeUser;
  certificate: CompletionCertificate | null;
  canIssue: boolean;
}

export interface IssueCertificateResult {
  certificate: CompletionCertificate;
  pdfGenerated: boolean;
  mailSent: boolean;
}

function getExaminerName(): string {
  const fromEnv = process.env.EXAMINER_NAME?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEFAULT_EXAMINER_NAME;
}

/** Date から JST 換算で year, month (1-12) を返す */
function getJstYearMonth(date: Date): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  return { year, month };
}

export class CertificateService {
  constructor(
    private readonly certRepo: ICompletionCertificateRepository,
    private readonly enrollmentRepo: IEnrollmentApplicationRepository,
    private readonly userManagementService: UserManagementServiceLikeForCertificate,
    private readonly pdfGenerator: CertificatePdfGenerator,
    private readonly fileWriter: CertificateFileWriter
  ) {}

  async getCertificateData(userId: string): Promise<CertificateView> {
    const user = await this.userManagementService.getUserById(userId);
    if (user === null) {
      throw new BusinessError("指定された受講者が見つかりません");
    }
    const certificate = await this.certRepo.findByUser(userId);
    const canIssue = user.status === UserStatus.COMPLETED && certificate === null;
    return { user, certificate, canIssue };
  }

  async issueCertificate(userId: string): Promise<IssueCertificateResult> {
    const user = await this.userManagementService.getUserById(userId);
    if (user === null) {
      throw new BusinessError("指定された受講者が見つかりません");
    }
    if (user.status !== UserStatus.COMPLETED) {
      throw new BusinessError("修了証明書の発行は COMPLETED 状態の受講者のみ実行できます");
    }
    // 重複チェック・採番・create・status 遷移を同一トランザクション内で原子的に実行する
    // (トランザクション外で findByUser/countByMonth を行うと並行発行で UNIQUE 違反が
    //  500 として漏れたり、採番が重複する可能性があるため)
    const issuedAt = new Date();
    const expiresAt = calculateExpiryDate(issuedAt);
    let certificate: CompletionCertificate;
    let certificateNumber: string;
    try {
      certificate = await getPrisma().$transaction(async (tx) => {
        const existing = await this.certRepo.findByUser(userId, tx);
        if (existing !== null) {
          throw new BusinessError("この受講者には既に修了証明書が発行されています");
        }
        const { year, month } = getJstYearMonth(issuedAt);
        const count = await this.certRepo.countByMonth(year, month, tx);
        const sequence = count + 1;
        const generatedNumber = formatCertificateNumber({
          institutionCode: INSTITUTION_CODE,
          issuedAt,
          sequence,
        });
        const created = await this.certRepo.create(
          {
            userId,
            certificateNumber: generatedNumber,
            issuedAt,
            expiresAt,
          } satisfies CreateCompletionCertificateInput,
          tx
        );
        await this.userManagementService.updateStatus(userId, UserStatus.CERTIFIED, tx);
        certificateNumber = generatedNumber;
        return created;
      });
      certificateNumber ??= certificate.certificateNumber;
    } catch (error: unknown) {
      // Prisma の UNIQUE 違反 (P2002) は並行発行による衝突を意味する。
      // 業務エラーに変換し、API 層で 400 として扱えるようにする。
      if (error instanceof PrismaNS.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessError("この受講者には既に修了証明書が発行されています");
      }
      throw error;
    }

    // PDF 生成 (副作用、失敗時もログのみ)
    const enrollment = await this.enrollmentRepo.findByUserId(userId);
    const applicantNumber = enrollment?.applicantNumber ?? "未設定";
    const pdfInput: CertificatePdfInput = {
      certificateNumber,
      studentName: user.name,
      applicantNumber,
      examinerName: getExaminerName(),
      issuedAt,
      expiresAt,
      institutionName: INSTITUTION_NAME,
      institutionCode: INSTITUTION_CODE,
      schoolName: SCHOOL_NAME,
      trainingOfficeCode: TRAINING_OFFICE_CODE,
    };

    let pdfGenerated = false;
    try {
      const buffer = await this.pdfGenerator.generate(pdfInput);
      const filePath = await this.fileWriter.write(certificateNumber, buffer);
      // updatePdfPath の戻り値で in-memory certificate を最新化する
      // (レスポンスの certificate.pdfPath を null のまま返さないため)
      certificate = await this.certRepo.updatePdfPath(certificate.id, filePath);
      pdfGenerated = true;
    } catch (error: unknown) {
      logger.error("修了証明書 PDF の生成・保存に失敗しました", error, {
        userId,
        certificateId: certificate.id,
      });
    }

    // メール送信 (副作用、失敗時もログのみ)
    let mailSent = false;
    try {
      await sendCertificateIssuedEmail({
        to: user.email,
        studentName: user.name,
        certificateNumber,
      });
      mailSent = true;
    } catch (error: unknown) {
      logger.error("修了証明書発行通知メールの送信に失敗しました", error, { userId });
    }

    return { certificate, pdfGenerated, mailSent };
  }
}
