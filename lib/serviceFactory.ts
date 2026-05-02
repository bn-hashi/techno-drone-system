import { UserRepository } from "@/repositories/userRepository";
import { UserManagementService } from "@/services/userManagementService";
import { EnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import { EnrollmentService } from "@/services/enrollmentService";

// Service インスタンスの生成を一元管理する
// ページ・API ルートはこのファクトリ経由で Service を取得する
export function getUserManagementService(): UserManagementService {
  return new UserManagementService(new UserRepository());
}

export function getEnrollmentService(): EnrollmentService {
  return new EnrollmentService(new EnrollmentApplicationRepository(), new UserRepository());
}
