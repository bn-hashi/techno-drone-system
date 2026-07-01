import { UserStatus } from "@/types/prisma";

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_REGISTRATION: "入学申請受付前",
  PENDING_ACTIVATION: "本登録待ち",
  ACTIVE: "受講中",
  EXAM_PASSED: "試験合格",
  COMPLETED: "修了",
  CERTIFIED: "資格取得",
  DIPS_LINKED: "DIPS連携済",
};
