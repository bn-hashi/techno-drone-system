import { UserRepository } from "@/repositories/userRepository";
import { UserManagementService } from "@/services/userManagementService";
import { EnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import { EnrollmentService } from "@/services/enrollmentService";
import { AgreementLogRepository } from "@/repositories/agreementLogRepository";
import { SetupService } from "@/services/setupService";

// Service インスタンスの生成を一元管理する
// ページ・API ルートはこのファクトリ経由で Service を取得する

/** ユーザー管理 Service のインスタンスを返す */
export function getUserManagementService(): UserManagementService {
  return new UserManagementService(new UserRepository());
}

/** 入学申請 Service のインスタンスを返す */
export function getEnrollmentService(): EnrollmentService {
  return new EnrollmentService(new EnrollmentApplicationRepository(), new UserRepository());
}

/** セットアップ（パスワード設定・規約同意）Service のインスタンスを返す */
export function getSetupService(): SetupService {
  return new SetupService(new UserRepository(), new AgreementLogRepository());
}
