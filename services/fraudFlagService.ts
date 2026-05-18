import type { FraudFlag } from "@prisma/client";
import type { IFraudFlagRepository } from "@/repositories/fraudFlagRepository";
import { FraudFlagType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

export class FraudFlagService {
  constructor(private readonly repo: IFraudFlagRepository) {}

  async flagTabLeave(userId: string, durationSeconds: number): Promise<FraudFlag> {
    if (durationSeconds < 0) {
      throw new BusinessError("タブ離脱時間は0以上を指定してください");
    }

    return this.repo.create({
      userId,
      type: FraudFlagType.TAB_LEAVE,
      description: `タブ離脱 ${durationSeconds} 秒`,
    });
  }
}
