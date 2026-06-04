import { getPrisma } from "@/lib/db";
import { SubjectProgress, Prisma } from "@prisma/client";

export interface UpsertSubjectProgressInput {
  userId: string;
  subjectId: string;
  totalWatchedMinutes: number;
  isFulfilled: boolean;
}

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface ISubjectProgressRepository {
  findByUserSubject(
    userId: string,
    subjectId: string,
    tx?: PrismaLike
  ): Promise<SubjectProgress | null>;
  findAllByUser(userId: string, tx?: PrismaLike): Promise<SubjectProgress[]>;
  upsert(input: UpsertSubjectProgressInput, tx?: PrismaLike): Promise<SubjectProgress>;
}

export class SubjectProgressRepository implements ISubjectProgressRepository {
  async findByUserSubject(
    userId: string,
    subjectId: string,
    tx?: PrismaLike
  ): Promise<SubjectProgress | null> {
    const prisma = tx ?? getPrisma();
    return prisma.subjectProgress.findUnique({
      where: { userId_subjectId: { userId, subjectId } },
    });
  }

  async findAllByUser(userId: string, tx?: PrismaLike): Promise<SubjectProgress[]> {
    const prisma = tx ?? getPrisma();
    return prisma.subjectProgress.findMany({ where: { userId } });
  }

  async upsert(input: UpsertSubjectProgressInput, tx?: PrismaLike): Promise<SubjectProgress> {
    const prisma = tx ?? getPrisma();
    return prisma.subjectProgress.upsert({
      where: { userId_subjectId: { userId: input.userId, subjectId: input.subjectId } },
      create: {
        userId: input.userId,
        subjectId: input.subjectId,
        totalWatchedMinutes: input.totalWatchedMinutes,
        isFulfilled: input.isFulfilled,
      },
      update: {
        totalWatchedMinutes: input.totalWatchedMinutes,
        isFulfilled: input.isFulfilled,
      },
    });
  }
}
