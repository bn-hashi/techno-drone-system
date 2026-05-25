import { getPrisma } from "@/lib/db";
import { ExamAnswer, Prisma } from "@prisma/client";

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface CreateExamAnswerInput {
  examId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
}

export interface IExamAnswerRepository {
  createMany(inputs: CreateExamAnswerInput[], tx?: PrismaLike): Promise<void>;
  findByExamId(examId: string, tx?: PrismaLike): Promise<ExamAnswer[]>;
}

export class ExamAnswerRepository implements IExamAnswerRepository {
  async createMany(inputs: CreateExamAnswerInput[], tx?: PrismaLike): Promise<void> {
    if (inputs.length === 0) return;
    const prisma = tx ?? getPrisma();
    await prisma.examAnswer.createMany({ data: inputs });
  }

  async findByExamId(examId: string, tx?: PrismaLike): Promise<ExamAnswer[]> {
    const prisma = tx ?? getPrisma();
    return prisma.examAnswer.findMany({ where: { examId } });
  }
}
