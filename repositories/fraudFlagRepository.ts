import { getPrisma } from "@/lib/db";
import { FraudFlag } from "@prisma/client";
import { FraudFlagType } from "@/types/prisma";

export interface CreateFraudFlagInput {
  userId: string;
  type: FraudFlagType;
  description?: string;
}

export interface IFraudFlagRepository {
  create(input: CreateFraudFlagInput): Promise<FraudFlag>;
}

export class FraudFlagRepository implements IFraudFlagRepository {
  async create(input: CreateFraudFlagInput): Promise<FraudFlag> {
    const prisma = getPrisma();
    return prisma.fraudFlag.create({ data: input });
  }
}
