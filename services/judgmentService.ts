import type { FraudFlag, JudgmentRecord } from "@prisma/client";
import type {
  IJudgmentRecordRepository,
  CreateJudgmentRecordInput,
} from "@/repositories/judgmentRecordRepository";
import type { IFraudFlagRepository } from "@/repositories/fraudFlagRepository";
import type { SubjectProgressView } from "@/services/progressService";
import type { SafeUser } from "@/services/userManagementService";
import { getPrisma } from "@/lib/db";
import { sendJudgmentRejectedEmail } from "@/services/emailService";
import { BusinessError } from "@/services/errors";
import { CourseType, JudgmentResult, UserStatus } from "@/types/prisma";
import { logger } from "@/lib/logger";

/** JudgmentService が依存する ProgressService の最小契約 */
export interface ProgressServiceLikeForJudgment {
  getProgressByUser(userId: string, courseType: CourseType): Promise<SubjectProgressView[]>;
}

/** JudgmentService が依存する UserManagementService の最小契約 */
export interface UserManagementServiceLikeForJudgment {
  getUserById(id: string): Promise<SafeUser | null>;
  // tx? は Issue #23 で追加済みのオーバーロード
  updateStatus(userId: string, newStatus: UserStatus, tx?: unknown): Promise<SafeUser>;
}

export interface JudgmentReviewData {
  user: SafeUser;
  progress: SubjectProgressView[];
  fraudFlags: FraudFlag[];
  judgmentHistory: JudgmentRecord[];
  /** 現在のステータスから「成立/不成立」判定操作が許可されるか */
  canJudge: boolean;
}

export interface JudgmentRejectResult {
  record: JudgmentRecord;
  mailSent: boolean;
}

export class JudgmentService {
  constructor(
    private readonly judgmentRepo: IJudgmentRecordRepository,
    private readonly fraudFlagRepo: IFraudFlagRepository,
    private readonly progressService: ProgressServiceLikeForJudgment,
    private readonly userManagementService: UserManagementServiceLikeForJudgment
  ) {}

  async getReviewData(userId: string): Promise<JudgmentReviewData> {
    const user = await this.userManagementService.getUserById(userId);
    if (user === null) {
      throw new BusinessError("指定された受講者が見つかりません");
    }

    const progress = user.courseType
      ? await this.progressService.getProgressByUser(userId, user.courseType as CourseType)
      : [];
    const fraudFlags = await this.fraudFlagRepo.findByUser(userId);
    const judgmentHistory = await this.judgmentRepo.findByUser(userId);

    return {
      user,
      progress,
      fraudFlags,
      judgmentHistory,
      canJudge: user.status === UserStatus.EXAM_PASSED,
    };
  }

  async judgeAccepted(
    userId: string,
    judgedBy: string,
    comment?: string
  ): Promise<JudgmentRecord> {
    const trimmedJudgedBy = judgedBy.trim();
    if (trimmedJudgedBy.length === 0) {
      throw new BusinessError("判定者名を入力してください");
    }

    const user = await this.userManagementService.getUserById(userId);
    if (user === null) {
      throw new BusinessError("指定された受講者が見つかりません");
    }
    if (user.status !== UserStatus.EXAM_PASSED) {
      throw new BusinessError(
        "受講成立判定は EXAM_PASSED 状態の受講者のみ実行できます"
      );
    }

    // 判定記録とステータス遷移は原子的に行う:
    // updateStatus が失敗した場合、判定記録もロールバックされる (Issue #23 の教訓)
    const record = await getPrisma().$transaction(async (tx) => {
      const input: CreateJudgmentRecordInput = {
        userId,
        result: JudgmentResult.ACCEPTED,
        judgedBy: trimmedJudgedBy,
        comment,
      };
      const created = await this.judgmentRepo.create(input, tx);
      await this.userManagementService.updateStatus(userId, UserStatus.COMPLETED, tx);
      return created;
    });

    return record;
  }

  async judgeRejected(
    userId: string,
    judgedBy: string,
    comment?: string
  ): Promise<JudgmentRejectResult> {
    const trimmedJudgedBy = judgedBy.trim();
    if (trimmedJudgedBy.length === 0) {
      throw new BusinessError("判定者名を入力してください");
    }

    const user = await this.userManagementService.getUserById(userId);
    if (user === null) {
      throw new BusinessError("指定された受講者が見つかりません");
    }
    if (user.status !== UserStatus.EXAM_PASSED) {
      throw new BusinessError(
        "受講不成立判定は EXAM_PASSED 状態の受講者のみ実行できます"
      );
    }

    // 不成立判定は status を変更しないため tx は不要 (単一書き込み)
    const record = await this.judgmentRepo.create({
      userId,
      result: JudgmentResult.REJECTED,
      judgedBy: trimmedJudgedBy,
      comment,
    });

    // メール通知は副作用なので、失敗時もログのみで成功扱い (Issue #23 教訓)
    let mailSent = false;
    try {
      await sendJudgmentRejectedEmail({
        to: user.email,
        studentName: user.name,
      });
      mailSent = true;
    } catch (error: unknown) {
      logger.error("不成立判定通知メールの送信に失敗しました", error, { userId });
    }

    return { record, mailSent };
  }
}
