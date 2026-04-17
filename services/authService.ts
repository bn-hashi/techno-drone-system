import { User } from "@prisma/client";
import { UserStatus } from "@/types/prisma";
import { isLoginAllowed, getLoginBlockedErrorCode } from "@/lib/authHelpers";
import type { IUserRepository } from "@/repositories/userRepository";
import bcrypt from "bcryptjs";

export type SafeUser = Omit<User, "passwordHash">;

export interface LoginResult {
  success: boolean;
  user?: SafeUser;
  error?: "invalid_credentials" | "account_not_active" | "account_pending";
}

export class AuthService {
  constructor(private userRepository: IUserRepository) {}

  async login(email: string, password: string): Promise<LoginResult> {
    // ユーザーをメールアドレスで検索
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return {
        success: false,
        error: "invalid_credentials",
      };
    }

    // ステータスでログイン可否を判定
    if (!isLoginAllowed(user.status)) {
      return {
        success: false,
        error: getLoginBlockedErrorCode(user.status),
      };
    }

    // パスワードを検証
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return {
        success: false,
        error: "invalid_credentials",
      };
    }

    // ログイン成功（passwordHash をレスポンスから除外）
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return {
      success: true,
      user: safeUser,
    };
  }
}
