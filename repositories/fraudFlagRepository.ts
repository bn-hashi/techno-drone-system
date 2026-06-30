import { getPrisma } from "@/lib/db";
import { FraudFlag } from "@prisma/client";
import { FraudFlagType } from "@/types/prisma";

export interface CreateFraudFlagInput {
  userId: string;
  type: FraudFlagType;
  description?: string;
}

export type FraudFlagWithUser = FraudFlag & {
  user: { id: string; name: string | null; email: string };
};

export interface IFraudFlagRepository {
  create(input: CreateFraudFlagInput): Promise<FraudFlag>;
  findByUser(userId: string): Promise<FraudFlag[]>;
  findAll(): Promise<FraudFlagWithUser[]>;
}

export class FraudFlagRepository implements IFraudFlagRepository {
  async create(input: CreateFraudFlagInput): Promise<FraudFlag> {
    const prisma = getPrisma();
    return prisma.fraudFlag.create({ data: input });
  }

  async findByUser(userId: string): Promise<FraudFlag[]> {
    const prisma = getPrisma();
    return prisma.fraudFlag.findMany({
      where: { userId },
      orderBy: { detectedAt: "desc" },
    });
  }

  async findAll(): Promise<FraudFlagWithUser[]> {
    const prisma = getPrisma();
    return prisma.fraudFlag.findMany({
      orderBy: { detectedAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }) as Promise<FraudFlagWithUser[]>;
  }
}
