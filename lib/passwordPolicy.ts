import { BusinessError } from "@/services/errors";

// パスワード最小文字数 (OWASP 推奨)
const PASSWORD_MIN_LENGTH = 8;

/**
 * パスワードポリシーを検証する
 *
 * - 必須（空文字不可）
 * - 8文字以上
 * - 大文字1文字以上
 * - 数字1文字以上
 *
 * @param rawPassword - 検証対象の平文パスワード
 * @throws {BusinessError} ポリシー違反の場合
 */
export function validatePasswordPolicy(rawPassword: string): void {
  if (!rawPassword) {
    throw new BusinessError("パスワードは必須です");
  }
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
