import { UserRepository } from "@/repositories/userRepository";
import { UserManagementService } from "@/services/userManagementService";

// Service インスタンスの生成を一元管理する
// ページ・API ルートはこのファクトリ経由で Service を取得する
export function getUserManagementService(): UserManagementService {
  return new UserManagementService(new UserRepository());
}
