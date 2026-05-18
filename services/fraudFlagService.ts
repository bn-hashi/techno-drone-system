import type { FraudFlag } from "@prisma/client";
import type { IFraudFlagRepository } from "@/repositories/fraudFlagRepository";
import { FraudFlagType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";
import { TAB_LEAVE_THRESHOLD_SECONDS } from "@/lib/constants";

export class FraudFlagService {
  constructor(private readonly repo: IFraudFlagRepository) {}

  async flagTabLeave(userId: string, durationSeconds: number): Promise<FraudFlag> {
    // クライアントを信頼せず、サーバー側でも 60 秒超ルールを強制する
    if (durationSeconds <= TAB_LEAVE_THRESHOLD_SECONDS) {
      throw new BusinessError(
        `タブ離脱時間は ${TAB_LEAVE_THRESHOLD_SECONDS} 秒を超えている必要があります`
      );
    }

    return this.repo.create({
      userId,
      type: FraudFlagType.TAB_LEAVE,
      description: `タブ離脱 ${durationSeconds} 秒`,
    });
  }
}
