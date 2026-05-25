import { QARecord } from "@prisma/client";
import type {
  IQARecordRepository,
  QARecordWithUser,
} from "@/repositories/qaRecordRepository";
import type { IUserRepository } from "@/repositories/userRepository";
import { sendAnswerNotificationEmail } from "@/services/emailService";
import { BusinessError, NotFoundError } from "@/services/errors";
import { logger } from "@/lib/logger";
import { QA_QUESTION_MAX_LENGTH, QA_ANSWER_MAX_LENGTH } from "@/lib/constants";

export interface AnswerQuestionResult {
  record: QARecord;
  mailSent: boolean;
}

export interface IQAService {
  createQuestion(userId: string, question: string): Promise<QARecord>;
  answerQuestion(
    qaId: string,
    answer: string,
    answeredBy: string
  ): Promise<AnswerQuestionResult>;
  listByUser(userId: string): Promise<QARecord[]>;
  listAll(unansweredOnly?: boolean): Promise<QARecordWithUser[]>;
}

export class QAService implements IQAService {
  constructor(
    private readonly qaRepo: IQARecordRepository,
    private readonly userRepo: IUserRepository
  ) {}

  async createQuestion(userId: string, question: string): Promise<QARecord> {
    const trimmed = question.trim();
    if (trimmed.length === 0) {
      throw new BusinessError("質問本文を入力してください");
    }
    if (trimmed.length > QA_QUESTION_MAX_LENGTH) {
      throw new BusinessError(
        `質問本文は ${QA_QUESTION_MAX_LENGTH} 文字以内で入力してください`
      );
    }
    return this.qaRepo.create({ userId, question: trimmed });
  }

  async answerQuestion(
    qaId: string,
    answer: string,
    answeredBy: string
  ): Promise<AnswerQuestionResult> {
    const trimmedAnswer = answer.trim();
    if (trimmedAnswer.length === 0) {
      throw new BusinessError("回答本文を入力してください");
    }
    if (trimmedAnswer.length > QA_ANSWER_MAX_LENGTH) {
      throw new BusinessError(
        `回答本文は ${QA_ANSWER_MAX_LENGTH} 文字以内で入力してください`
      );
    }

    const existing = await this.qaRepo.findById(qaId);
    if (existing === null) {
      throw new NotFoundError("指定された質問が見つかりません");
    }

    const record = await this.qaRepo.updateAnswer(qaId, {
      answer: trimmedAnswer,
      answeredAt: new Date(),
      answeredBy,
    });

    // メール通知は副作用なのでトランザクション境界外。
    // 失敗してもログのみで、回答の DB 保存は成功扱いとする。
    const mailSent = await this.notifyAnswerByEmail(record.userId, existing.question, trimmedAnswer);

    return { record, mailSent };
  }

  async listByUser(userId: string): Promise<QARecord[]> {
    return this.qaRepo.findByUser(userId);
  }

  async listAll(unansweredOnly = false): Promise<QARecordWithUser[]> {
    return this.qaRepo.findAllWithUser({ unansweredOnly });
  }

  private async notifyAnswerByEmail(
    userId: string,
    question: string,
    answer: string
  ): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    if (user === null) {
      logger.error("回答通知メールの送信先ユーザーが見つかりませんでした", undefined, {
        userId,
      });
      return false;
    }
    try {
      await sendAnswerNotificationEmail({
        to: user.email,
        studentName: user.name,
        question,
        answer,
      });
      return true;
    } catch (error: unknown) {
      logger.error("回答通知メールの送信に失敗しました", error, { userId });
      return false;
    }
  }
}
