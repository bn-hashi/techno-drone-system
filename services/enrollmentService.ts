import { unlinkFile } from "@/lib/fsAdapter";
import type { EnrollmentApplication } from "@prisma/client";
import type {
  EnrollmentApplicationListItem,
  IEnrollmentApplicationRepository,
} from "@/repositories/enrollmentApplicationRepository";
import type { IUserRepository } from "@/repositories/userRepository";
import { saveUploadedFile } from "@/lib/upload";
import {
  BusinessError,
  DuplicateEnrollmentError,
  EnrollmentNotFoundError,
  UserNotFoundError,
} from "@/services/errors";

// ドキュメントフィールド名とアップロード先サブディレクトリのマッピング
const DOCUMENT_SUBDIRECTORIES = {
  idDocument: "id-documents",
  photo: "photos",
  experienceCert: "experience-certs",
} as const;

export type DocumentFieldName = keyof typeof DOCUMENT_SUBDIRECTORIES;

export interface DocumentFileEntry {
  field: DocumentFieldName;
  file: File;
}

export interface CreateEnrollmentInput {
  userId: string;
  dateOfBirth: Date;
  address: string;
  phoneNumber: string;
}

export class EnrollmentService {
  constructor(
    private readonly enrollmentRepo: IEnrollmentApplicationRepository,
    private readonly userRepo: IUserRepository
  ) {}

  async listEnrollments(): Promise<EnrollmentApplicationListItem[]> {
    return this.enrollmentRepo.findAll();
  }

  async createEnrollment(input: CreateEnrollmentInput): Promise<EnrollmentApplication> {
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

  async acceptEnrollment(applicationId: string): Promise<EnrollmentApplication> {
    const application = await this.enrollmentRepo.findById(applicationId);
    if (application === null) {
      throw new EnrollmentNotFoundError(applicationId);
    }

    // 申請受理とユーザーステータス遷移（PENDING_ACTIVATION）を1トランザクションでアトミックに実行する
    return this.enrollmentRepo.accept(applicationId, application.userId);
  }

  /**
   * 書類ファイルを保存し、申請レコードのパスを更新する
   *
   * - fileEntries が空、またはいずれかのファイルが 0 バイトの場合は BusinessError
   * - ファイル保存中にエラーが発生した場合は保存済みファイルを全て削除して re-throw（Issue #13）
   * - DB 更新に失敗した場合も保存済みファイルを全て削除して re-throw（Issue #13）
   */
  async uploadDocuments(userId: string, fileEntries: DocumentFileEntry[]): Promise<void> {
    if (fileEntries.length === 0) {
      throw new BusinessError("ファイルが1件も提供されていません");
    }

    // Issue #12: 0 バイトファイルが混在していたら即座に BusinessError（フィールド名を含めて報告）
    const zeroByteEntry = fileEntries.find(({ file }) => file.size === 0);
    if (zeroByteEntry !== undefined) {
      throw new BusinessError(`${zeroByteEntry.field} に0バイトのファイルが含まれています`);
    }

    const application = await this.enrollmentRepo.findByUserId(userId);
    if (application === null) {
      throw new EnrollmentNotFoundError(userId);
    }

    // Issue #13: 保存済みパスを記録し、失敗時にクリーンアップできるようにする
    const savedPaths: string[] = [];

    try {
      for (const { field, file } of fileEntries) {
        const savedPath = await saveUploadedFile(file, DOCUMENT_SUBDIRECTORIES[field]);
        savedPaths.push(savedPath);
      }
    } catch (error) {
      // ファイル保存失敗: 保存済みファイルを全て削除する
      await this.cleanupSavedFiles(savedPaths);
      throw error;
    }

    try {
      // 保存したパスを DocumentFieldName → path のマップに変換してから update に渡す
      const pathRecord: Partial<Record<DocumentFieldName, string>> = {};
      fileEntries.forEach(({ field }, index) => {
        pathRecord[field] = savedPaths[index];
      });

      await this.enrollmentRepo.update(application.id, {
        ...(pathRecord.idDocument !== undefined && { idDocumentPath: pathRecord.idDocument }),
        ...(pathRecord.photo !== undefined && { photoPath: pathRecord.photo }),
        ...(pathRecord.experienceCert !== undefined && {
          experienceCertPath: pathRecord.experienceCert,
        }),
      });
    } catch (error) {
      // DB 更新失敗: 保存済みファイルを全て削除する
      await this.cleanupSavedFiles(savedPaths);
      throw error;
    }
  }

  /** 保存済みファイルをベストエフォートで削除する（失敗しても握りつぶさない） */
  private async cleanupSavedFiles(paths: string[]): Promise<void> {
    await Promise.allSettled(paths.map((path) => unlinkFile(path)));
  }

  private validateInput(input: CreateEnrollmentInput): void {
    if (!input.dateOfBirth) {
      throw new BusinessError("生年月日は必須です");
    }
    const now = new Date();
    if (input.dateOfBirth > now) {
      throw new BusinessError("生年月日に未来の日付は使用できません");
    }
    if (!input.address) {
      throw new BusinessError("住所は必須です");
    }
    if (!input.phoneNumber) {
      throw new BusinessError("電話番号は必須です");
    }
  }
}
