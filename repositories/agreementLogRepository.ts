import { getPrisma } from "@/lib/db";
import { AgreementLog } from "@prisma/client";

// 規約バージョン番号 (規約を改訂する際はこの値を更新する)
const CURRENT_AGREEMENT_VERSION = "1.0";

export interface IAgreementLogRepository {
  create(data: { userId: string; agreedAt: Date; ipAddress: string }): Promise<AgreementLog>;
}

export class AgreementLogRepository implements IAgreementLogRepository {
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
}
