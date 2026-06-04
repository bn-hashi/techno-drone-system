import { getPrisma } from "@/lib/db";
import { Exam, Prisma } from "@prisma/client";
import { ExamStatus } from "@/types/prisma";

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface CreateExamInput {
  userId: string;
  totalQuestions: number;
  questionIds: string[];
}

export interface UpdateExamInput {
  score?: number;
  passed?: boolean;
  status?: ExamStatus;
  endedAt?: Date;
}

export interface IExamRepository {
  findById(id: string, tx?: PrismaLike): Promise<Exam | null>;
  findByUserAndStatus(userId: string, status: ExamStatus, tx?: PrismaLike): Promise<Exam | null>;
  findAllWithUser(tx?: PrismaLike): Promise<ExamWithUser[]>;
  findByUserOrderByStartedAtDesc(userId: string, tx?: PrismaLike): Promise<Exam[]>;
  create(input: CreateExamInput, tx?: PrismaLike): Promise<Exam>;
  update(id: string, input: UpdateExamInput, tx?: PrismaLike): Promise<Exam>;
}

export type ExamWithUser = Exam & {
  user: { id: string; name: string; email: string };
};

export class ExamRepository implements IExamRepository {
  async findById(id: string, tx?: PrismaLike): Promise<Exam | null> {
    const prisma = tx ?? getPrisma();
    return prisma.exam.findUnique({ where: { id } });
  }

  async findByUserAndStatus(
    userId: string,
    status: ExamStatus,
    tx?: PrismaLike
  ): Promise<Exam | null> {
    const prisma = tx ?? getPrisma();
    return prisma.exam.findFirst({ where: { userId, status } });
  }

  async findAllWithUser(tx?: PrismaLike): Promise<ExamWithUser[]> {
    const prisma = tx ?? getPrisma();
    // include: { user: true } は User.passwordHash まで返してしまうため、
    // 表示に必要な id/name/email のみを select する。
    return prisma.exam.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { startedAt: "desc" },
    }) as Promise<ExamWithUser[]>;
  }

  async findByUserOrderByStartedAtDesc(userId: string, tx?: PrismaLike): Promise<Exam[]> {
    const prisma = tx ?? getPrisma();
    return prisma.exam.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
    });
  }

  async create(input: CreateExamInput, tx?: PrismaLike): Promise<Exam> {
    const prisma = tx ?? getPrisma();
    return prisma.exam.create({
      data: {
        userId: input.userId,
        totalQuestions: input.totalQuestions,
        questionIds: input.questionIds,
      },
    });
  }

  async update(id: string, input: UpdateExamInput, tx?: PrismaLike): Promise<Exam> {
    const prisma = tx ?? getPrisma();
    return prisma.exam.update({ where: { id }, data: input });
  }
}
