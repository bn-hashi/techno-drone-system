import { getPrisma } from "@/lib/db";
import { JudgmentRecord, Prisma } from "@prisma/client";
import { JudgmentResult } from "@/types/prisma";

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface CreateJudgmentRecordInput {
  userId: string;
  result: JudgmentResult;
  judgedBy: string;
  comment?: string;
}

export interface IJudgmentRecordRepository {
  create(input: CreateJudgmentRecordInput, tx?: PrismaLike): Promise<JudgmentRecord>;
  findByUser(userId: string, tx?: PrismaLike): Promise<JudgmentRecord[]>;
  findLatestByUser(userId: string, tx?: PrismaLike): Promise<JudgmentRecord | null>;
}

export class JudgmentRecordRepository implements IJudgmentRecordRepository {
  async create(
    input: CreateJudgmentRecordInput,
    tx?: PrismaLike
  ): Promise<JudgmentRecord> {
    const prisma = tx ?? getPrisma();
    return prisma.judgmentRecord.create({
      data: {
        userId: input.userId,
        result: input.result,
        comment: input.comment,
        judgedBy: input.judgedBy,
      },
    });
  }

  async findByUser(userId: string, tx?: PrismaLike): Promise<JudgmentRecord[]> {
    const prisma = tx ?? getPrisma();
    return prisma.judgmentRecord.findMany({
      where: { userId },
      orderBy: { judgedAt: "desc" },
    });
  }

  async findLatestByUser(
    userId: string,
    tx?: PrismaLike
  ): Promise<JudgmentRecord | null> {
    const prisma = tx ?? getPrisma();
    return prisma.judgmentRecord.findFirst({
      where: { userId },
      orderBy: { judgedAt: "desc" },
    });
  }
}
