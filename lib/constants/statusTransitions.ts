import { UserStatus } from "@/types/prisma";

/**
 * ユーザーステータスの有効な遷移先マップ
 * 線形な状態機械: 各ステータスから次の1つのステータスにのみ進める
 */
export const STATUS_TRANSITIONS: Record<UserStatus, readonly UserStatus[]> = {
  [UserStatus.PENDING_REGISTRATION]: [UserStatus.PENDING_ACTIVATION],
  [UserStatus.PENDING_ACTIVATION]: [UserStatus.ACTIVE],
  [UserStatus.ACTIVE]: [UserStatus.EXAM_PASSED],
  [UserStatus.EXAM_PASSED]: [UserStatus.COMPLETED],
  [UserStatus.COMPLETED]: [UserStatus.CERTIFIED],
  [UserStatus.CERTIFIED]: [UserStatus.DIPS_LINKED],
  [UserStatus.DIPS_LINKED]: [],
};

/**
 * 指定ステータスから遷移可能な次のステータス一覧を返す
 */
export function getNextStatuses(current: UserStatus): readonly UserStatus[] {
  return STATUS_TRANSITIONS[current];
}

/**
 * from → to の遷移が有効かどうかを検証する
 */
export function isValidTransition(from: UserStatus, to: UserStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
