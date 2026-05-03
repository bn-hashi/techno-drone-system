import type { EnrollmentApplication } from "@prisma/client";
import type { IEnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import type { IUserRepository } from "@/repositories/userRepository";
import { UserStatus } from "@/types/prisma";
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

  async acceptEnrollment(
    applicationId: string
  ): Promise<EnrollmentApplication> {
    const application = await this.enrollmentRepo.findById(applicationId);
    if (application === null) {
      throw new EnrollmentNotFoundError(applicationId);
    }

    const updated = await this.enrollmentRepo.update(applicationId, {
      acceptedAt: new Date(),
    });

    // 入学申請受理と同時にユーザーステータスを本登録待ちに遷移させる
    await this.userRepo.updateStatus(application.userId, UserStatus.PENDING_ACTIVATION);

    return updated;
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
