import { getPrisma } from "@/lib/db";
import { QARecord, Prisma } from "@prisma/client";

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface CreateQARecordInput {
  userId: string;
  question: string;
}

export interface UpdateAnswerInput {
  answer: string;
  answeredAt: Date;
  answeredBy: string;
}

export interface FindAllFilter {
  unansweredOnly?: boolean;
}

export type QARecordWithUser = QARecord & {
  user: { id: string; name: string; email: string };
};

export interface IQARecordRepository {
  findById(id: string, tx?: PrismaLike): Promise<QARecord | null>;
  findByUser(userId: string, tx?: PrismaLike): Promise<QARecord[]>;
  findAllWithUser(filter?: FindAllFilter, tx?: PrismaLike): Promise<QARecordWithUser[]>;
  create(input: CreateQARecordInput, tx?: PrismaLike): Promise<QARecord>;
  updateAnswer(id: string, input: UpdateAnswerInput, tx?: PrismaLike): Promise<QARecord>;
}

export class QARecordRepository implements IQARecordRepository {
  async findById(id: string, tx?: PrismaLike): Promise<QARecord | null> {
    const prisma = tx ?? getPrisma();
    return prisma.qARecord.findUnique({ where: { id } });
  }

  async findByUser(userId: string, tx?: PrismaLike): Promise<QARecord[]> {
    const prisma = tx ?? getPrisma();
    return prisma.qARecord.findMany({
      where: { userId },
      orderBy: { questionedAt: "desc" },
    });
  }

  async findAllWithUser(
    filter?: FindAllFilter,
    tx?: PrismaLike
  ): Promise<QARecordWithUser[]> {
    const prisma = tx ?? getPrisma();
    const baseArgs = {
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { questionedAt: "desc" as const },
    };
    if (filter?.unansweredOnly) {
      return prisma.qARecord.findMany({
        where: { answer: null },
        ...baseArgs,
      }) as Promise<QARecordWithUser[]>;
    }
    return prisma.qARecord.findMany(baseArgs) as Promise<QARecordWithUser[]>;
  }

  async create(input: CreateQARecordInput, tx?: PrismaLike): Promise<QARecord> {
    const prisma = tx ?? getPrisma();
    return prisma.qARecord.create({
      data: {
        userId: input.userId,
        question: input.question,
      },
    });
  }

  async updateAnswer(
    id: string,
    input: UpdateAnswerInput,
    tx?: PrismaLike
  ): Promise<QARecord> {
    const prisma = tx ?? getPrisma();
    return prisma.qARecord.update({
      where: { id },
      data: {
        answer: input.answer,
        answeredAt: input.answeredAt,
        answeredBy: input.answeredBy,
      },
    });
  }
}
