import { User } from "@prisma/client"
import { UserStatus } from "@/types/prisma"
import { isLoginAllowed } from "@/lib/authHelpers"
import bcrypt from "bcryptjs"

export interface LoginResult {
  success: boolean
  user?: User
  error?: "invalid_credentials" | "account_not_active" | "account_pending"
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
}

export class AuthService {
  constructor(private userRepository: IUserRepository) {}

  async login(email: string, password: string): Promise<LoginResult> {
    // ユーザーをメールアドレスで検索
    const user = await this.userRepository.findByEmail(email)
    if (!user) {
      return {
        success: false,
        error: "invalid_credentials",
      }
    }

    // ステータスでログイン可否を判定
    if (!isLoginAllowed(user.status)) {
      if (user.status === UserStatus.PENDING_REGISTRATION) {
        return {
          success: false,
          error: "account_not_active",
        }
      }
      if (user.status === UserStatus.PENDING_ACTIVATION) {
        return {
          success: false,
          error: "account_pending",
        }
      }
    }

    // パスワードを検証
    const passwordMatch = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatch) {
      return {
        success: false,
        error: "invalid_credentials",
      }
    }

    // ログイン成功
    return {
      success: true,
      user,
    }
  }
}
