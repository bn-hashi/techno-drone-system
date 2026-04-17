import { UserRole, UserStatus } from "@/types/prisma";

/**
 * JWT ペイロードの role フィールドが有効な UserRole か検証する型ガード
 */
export function isValidUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

/**
 * JWT ペイロードの status フィールドが有効な UserStatus か検証する型ガード
 */
export function isValidUserStatus(value: unknown): value is UserStatus {
  return Object.values(UserStatus).includes(value as UserStatus);
}

/**
 * ログインブロック時のエラーコードを返す純粋関数
 * authService で使用し、重複した if チェーンを排除する
 */
export function getLoginBlockedErrorCode(
  status: UserStatus
): "account_not_active" | "account_pending" {
  return status === UserStatus.PENDING_ACTIVATION ? "account_pending" : "account_not_active";
}

/**
 * ログイン許可条件を判定する純粋関数
 * ACTIVE 以上のステータスのみ許可
 */
export function isLoginAllowed(status: UserStatus): boolean {
  const allowedStatuses: readonly UserStatus[] = [
    UserStatus.ACTIVE,
    UserStatus.EXAM_PASSED,
    UserStatus.COMPLETED,
    UserStatus.CERTIFIED,
    UserStatus.DIPS_LINKED,
  ];
  return allowedStatuses.includes(status);
}

/**
 * ログインがブロックされた理由を返す
 * ログイン許可されていないステータスに対してのみ有効
 */
export function getLoginBlockedMessage(status: UserStatus): string {
  switch (status) {
    case UserStatus.PENDING_REGISTRATION:
      return "アカウント登録が完了していません";
    case UserStatus.PENDING_ACTIVATION:
      return "本登録メールをご確認ください";
    default:
      return "ログインできないステータスです";
  }
}
