import { UserStatus } from "@/types/prisma";

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
