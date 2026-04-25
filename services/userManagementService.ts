import bcrypt from "bcryptjs";
import { User } from "@prisma/client";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import type { IUserRepository } from "@/repositories/userRepository";
import { isValidTransition } from "@/lib/constants/statusTransitions";

// パスワードハッシュ化のソルトラウンド数
// OWASP 推奨の最小値: 10
const BCRYPT_SALT_ROUNDS = 10;

// メールアドレス書式の正規表現
// ローカル部@ドメイン の基本形式を検証する
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SafeUser = Omit<User, "passwordHash">;

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  courseType: CourseType;
}

export interface UserListFilter {
  status?: UserStatus;
}

export class UserManagementService {
  constructor(private readonly userRepository: IUserRepository) {}

  async listUsers(filter?: UserListFilter): Promise<SafeUser[]> {
    const users = await this.userRepository.findAll(filter);
    return users.map(this.toSafeUser);
  }

  async createUser(input: CreateUserInput): Promise<SafeUser> {
    this.validateCreateUserInput(input);

    const existing = await this.userRepository.findByEmail(input.email);
    if (existing !== null) {
      throw new Error("このメールアドレスはすでに使用されています");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    // 新規ユーザーは必ず STUDENT ロール・PENDING_REGISTRATION ステータスで作成する
    const user = await this.userRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
      courseType: input.courseType,
      role: UserRole.STUDENT,
      status: UserStatus.PENDING_REGISTRATION,
    });

    return this.toSafeUser(user);
  }

  async updateStatus(userId: string, newStatus: UserStatus): Promise<SafeUser> {
    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new Error("ユーザーが見つかりません");
    }

    // user.status は Prisma 生成型のため @/types/prisma の UserStatus にキャストする
    // 両者は同一の string 値を持つため実行時安全
    if (!isValidTransition(user.status as UserStatus, newStatus)) {
      throw new Error("無効なステータス遷移です");
    }

    const updated = await this.userRepository.updateStatus(userId, newStatus);
    return this.toSafeUser(updated);
  }

  private validateCreateUserInput(input: CreateUserInput): void {
    if (!input.email) {
      throw new Error("メールアドレスは必須です");
    }
    if (!EMAIL_REGEX.test(input.email)) {
      throw new Error("メールアドレスの形式が正しくありません");
    }
    if (!input.name) {
      throw new Error("氏名は必須です");
    }
    if (!input.password) {
      throw new Error("パスワードは必須です");
    }
    if (input.password.length < 8) {
      throw new Error("パスワードは8文字以上で入力してください");
    }
  }

  private toSafeUser(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
