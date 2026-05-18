import { getPrisma } from "@/lib/db";
import { SubjectProgress } from "@prisma/client";

export interface UpsertSubjectProgressInput {
  userId: string;
  subjectId: string;
  totalWatchedMinutes: number;
  isFulfilled: boolean;
}

export interface ISubjectProgressRepository {
  findByUserSubject(userId: string, subjectId: string): Promise<SubjectProgress | null>;
  findAllByUser(userId: string): Promise<SubjectProgress[]>;
  upsert(input: UpsertSubjectProgressInput): Promise<SubjectProgress>;
}

export class SubjectProgressRepository implements ISubjectProgressRepository {
  async findByUserSubject(userId: string, subjectId: string): Promise<SubjectProgress | null> {
    const prisma = getPrisma();
    return prisma.subjectProgress.findUnique({
      where: { userId_subjectId: { userId, subjectId } },
    });
  }

  async findAllByUser(userId: string): Promise<SubjectProgress[]> {
    const prisma = getPrisma();
    return prisma.subjectProgress.findMany({ where: { userId } });
  }

  async upsert(input: UpsertSubjectProgressInput): Promise<SubjectProgress> {
    const prisma = getPrisma();
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
