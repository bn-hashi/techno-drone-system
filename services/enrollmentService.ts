import type { EnrollmentApplication } from "@prisma/client";
import type { IEnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import type { IUserRepository } from "@/repositories/userRepository";
import { saveUploadedFile } from "@/lib/upload";
import {
  BusinessError,
  DuplicateEnrollmentError,
  EnrollmentNotFoundError,
  UserNotFoundError,
} from "@/services/errors";

export interface CreateEnrollmentInput {
  userId: string;
  dateOfBirth: Date;
  address: string;
  phoneNumber: string;
}

// ドキュメント種別と保存先サブディレクトリのマッピング
const DOCUMENT_TYPE_MAP: Record<
  DocumentType,
  { subdirectory: string; field: keyof Pick<EnrollmentApplication, "idDocumentPath" | "photoPath" | "experienceCertPath"> }
> = {
  idDocument: { subdirectory: "id-documents", field: "idDocumentPath" },
  photo: { subdirectory: "photos", field: "photoPath" },
  experienceCert: { subdirectory: "experience-certs", field: "experienceCertPath" },
};

export type DocumentType = "idDocument" | "photo" | "experienceCert";

export class EnrollmentService {
  constructor(
    private readonly enrollmentRepo: IEnrollmentApplicationRepository,
    private readonly userRepo: IUserRepository
  ) {}

  async createEnrollment(
    input: CreateEnrollmentInput
  ): Promise<EnrollmentApplication> {
    this.validateInput(input);

    const user = await this.userRepo.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(input.userId);
    }

    const existing = await this.enrollmentRepo.findByUserId(input.userId);
    if (existing !== null) {
      throw new DuplicateEnrollmentError(input.userId);
    }

    return this.enrollmentRepo.create(input);
  }

  async uploadDocument(
    applicationId: string,
    documentType: DocumentType,
    file: File
  ): Promise<EnrollmentApplication> {
    const application = await this.enrollmentRepo.findById(applicationId);
    if (application === null) {
      throw new EnrollmentNotFoundError(applicationId);
    }

    const { subdirectory, field } = DOCUMENT_TYPE_MAP[documentType];
    const filePath = await saveUploadedFile(file, subdirectory);

    return this.enrollmentRepo.update(applicationId, { [field]: filePath });
  }

  async acceptEnrollment(
    applicationId: string
  ): Promise<EnrollmentApplication> {
    const application = await this.enrollmentRepo.findById(applicationId);
    if (application === null) {
      throw new EnrollmentNotFoundError(applicationId);
    }

    return this.enrollmentRepo.update(applicationId, {
      acceptedAt: new Date(),
    });
  }

  private validateInput(input: CreateEnrollmentInput): void {
    if (!input.dateOfBirth) {
      throw new BusinessError("生年月日は必須です");
    }
    if (!input.address) {
      throw new BusinessError("住所は必須です");
    }
    if (!input.phoneNumber) {
      throw new BusinessError("電話番号は必須です");
    }
  }
}
