import bcrypt from "bcryptjs";
import { generateInviteToken, verifyInviteToken } from "@/lib/token";
import { sendInviteEmail as sendEmail } from "@/services/emailService";
import type { IUserRepository } from "@/repositories/userRepository";
import type { IAgreementLogRepository } from "@/repositories/agreementLogRepository";
import { BusinessError, UserNotFoundError } from "@/services/errors";
import { UserStatus } from "@/types/prisma";

// bcrypt ソルトラウンド数 (OWASP 推奨: 12以上)
const BCRYPT_SALT_ROUNDS = 12;

// パスワード最小文字数
const PASSWORD_MIN_LENGTH = 8;

/**
 * パスワードポリシーを検証する
 *
 * - 8文字以上
 * - 大文字1文字以上
 * - 数字1文字以上
 */
function validatePasswordPolicy(rawPassword: string): void {
  if (rawPassword.length < PASSWORD_MIN_LENGTH) {
    throw new BusinessError(`パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`);
  }
  if (!/[A-Z]/.test(rawPassword)) {
    throw new BusinessError("パスワードには大文字を1文字以上含めてください");
  }
  if (!/[0-9]/.test(rawPassword)) {
    throw new BusinessError("パスワードには数字を1文字以上含めてください");
  }
}

export class SetupService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly agreementLogRepo: IAgreementLogRepository
  ) {}

  /**
   * 招待メールを送信する
   *
   * @param userId - 招待対象ユーザーの ID
   * @param baseUrl - アプリのベース URL (例: https://example.com)
   */
  async sendInviteEmail(userId: string, baseUrl: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const token = generateInviteToken(userId);
    const setupUrl = `${baseUrl}/setup/password?token=${token}`;

    await sendEmail({
      to: user.email,
      setupUrl,
      studentName: user.name,
    });
  }

  /**
   * パスワードを設定する
   *
   * @param token - 招待トークン
   * @param rawPassword - 平文パスワード
   */
  async setPassword(token: string, rawPassword: string): Promise<void> {
    const payload = verifyInviteToken(token);
    if (!payload) {
      throw new BusinessError(
        "トークンが無効または期限切れです。管理者に再送信を依頼してください。"
      );
    }

    // トークン再利用攻撃を防ぐため、PENDING_ACTIVATION ステータスのユーザーのみ許可する
    const user = await this.userRepo.findById(payload.userId);
    if (!user || user.status !== UserStatus.PENDING_ACTIVATION) {
      throw new BusinessError(
        "トークンが無効または期限切れです。管理者に再送信を依頼してください。"
      );
    }

    validatePasswordPolicy(rawPassword);

    const hashedPassword = await bcrypt.hash(rawPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepo.updatePassword(payload.userId, hashedPassword);
  }

  /**
   * 受講規約に同意し、ユーザーステータスを ACTIVE に更新する
   *
   * @param userId - 同意ユーザーの ID
   * @param ipAddress - リクエスト元の IP アドレス (ログ記録用)
   */
  async agreeToTerms(userId: string, ipAddress: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    await this.agreementLogRepo.create({
      userId,
      agreedAt: new Date(),
      ipAddress,
    });
    await this.userRepo.updateStatus(userId, UserStatus.ACTIVE);
  }
}
