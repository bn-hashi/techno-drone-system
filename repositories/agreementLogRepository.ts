import { getPrisma } from "@/lib/db";
import { AgreementLog } from "@prisma/client";
import { UserStatus } from "@/types/prisma";

// 規約バージョン番号 (規約を改訂する際はこの値を更新する)
const CURRENT_AGREEMENT_VERSION = "1.0";

/** 受講規約同意ログの永続化を担うリポジトリインターフェース */
export interface IAgreementLogRepository {
  /**
   * 受講規約同意ログを作成する
   *
   * @param data - ユーザーID・同意日時・IPアドレス
   * @returns 作成された AgreementLog レコード
   */
  create(data: { userId: string; agreedAt: Date; ipAddress: string }): Promise<AgreementLog>;

  /**
   * 受講規約同意ログの作成とユーザーステータスの ACTIVE 更新をアトミックに実行する
   *
   * ログ作成とステータス更新を $transaction で包み、部分的な書き込みを防止する。
   *
   * @param data - ユーザーID・同意日時・IPアドレス
   * @returns 作成された AgreementLog レコード
   */
  createAndActivateUser(data: {
    userId: string;
    agreedAt: Date;
    ipAddress: string;
  }): Promise<AgreementLog>;
}

export class AgreementLogRepository implements IAgreementLogRepository {
  /** @inheritdoc */
  async create(data: { userId: string; agreedAt: Date; ipAddress: string }): Promise<AgreementLog> {
    const prisma = getPrisma();
    return prisma.agreementLog.create({
      data: {
        userId: data.userId,
        version: CURRENT_AGREEMENT_VERSION,
        agreedAt: data.agreedAt,
        ipAddress: data.ipAddress,
      },
    });
  }

  /** @inheritdoc */
  async createAndActivateUser(data: {
    userId: string;
    agreedAt: Date;
    ipAddress: string;
  }): Promise<AgreementLog> {
    const prisma = getPrisma();
    const [log] = await prisma.$transaction([
      prisma.agreementLog.create({
        data: {
          userId: data.userId,
          version: CURRENT_AGREEMENT_VERSION,
          agreedAt: data.agreedAt,
          ipAddress: data.ipAddress,
        },
      }),
      prisma.user.update({
        where: { id: data.userId },
        data: { status: UserStatus.ACTIVE },
      }),
    ]);
    return log;
  }
}
