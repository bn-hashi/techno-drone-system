import type { ICompletionCertificateRepository } from "@/repositories/completionCertificateRepository";
import type { IEnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import type { SafeUser } from "@/services/userManagementService";
import { BusinessError } from "@/services/errors";

/** 様式5 (修了証明書交付台帳) PDF 生成に必要な入力 */
export interface CertificateLedgerInput {
  certificateNumber: string;
  studentName: string;
  applicantNumber: string;
  issuedAt: Date;
  expiresAt: Date;
}

/** 様式5 PDF 生成の抽象 (依存注入でテストしやすくする) */
export interface CertificateLedgerPdfGenerator {
  generate(input: CertificateLedgerInput): Promise<Buffer>;
}

/** CertificateLedgerService が必要とする受講者参照の最小契約 */
export interface UserLookupForLedger {
  getUserById(id: string): Promise<SafeUser | null>;
}

/** enrollment に技能証明申請者番号が無い場合のフォールバック表記 */
const APPLICANT_NUMBER_FALLBACK = "未設定";

/**
 * 様式5 (修了証明書交付台帳) を扱う Service。
 *
 * 台帳は登録講習機関が保管する管理者向けの内部文書であり、様式1 (修了証明書) と異なり
 * 永続化しない。発行済み証明書から要求のたびに PDF を生成する (1 件ごと)。
 */
export class CertificateLedgerService {
  constructor(
    private readonly certRepo: ICompletionCertificateRepository,
    private readonly enrollmentRepo: IEnrollmentApplicationRepository,
    private readonly userLookup: UserLookupForLedger,
    private readonly ledgerGenerator: CertificateLedgerPdfGenerator
  ) {}

  /** 指定受講者の発行済み修了証明書から様式5 PDF を生成して返す */
  async getLedgerPdf(userId: string): Promise<Buffer> {
    const user = await this.userLookup.getUserById(userId);
    if (user === null) {
      throw new BusinessError("指定された受講者が見つかりません");
    }

    const certificate = await this.certRepo.findByUser(userId);
    if (certificate === null) {
      throw new BusinessError("修了証明書がまだ発行されていません");
    }

    const enrollment = await this.enrollmentRepo.findByUserId(userId);
    const applicantNumber = enrollment?.applicantNumber ?? APPLICANT_NUMBER_FALLBACK;

    const input: CertificateLedgerInput = {
      certificateNumber: certificate.certificateNumber,
      studentName: user.name,
      applicantNumber,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
    };
    return this.ledgerGenerator.generate(input);
  }
}
