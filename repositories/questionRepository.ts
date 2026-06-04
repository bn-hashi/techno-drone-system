import { getPrisma } from "@/lib/db";
import { Question, Prisma } from "@prisma/client";

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface QuestionFilter {
  subjectId?: string;
}

export interface CreateQuestionInput {
  subjectId: string;
  body: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface UpdateQuestionInput {
  subjectId?: string;
  body?: string;
  choices?: string[];
  correctIndex?: number;
  explanation?: string;
}

export interface IQuestionRepository {
  findAll(filter?: QuestionFilter, limit?: number, tx?: PrismaLike): Promise<Question[]>;
  findById(id: string, tx?: PrismaLike): Promise<Question | null>;
  findManyByIds(ids: string[], tx?: PrismaLike): Promise<Question[]>;
  findBySubjectAndBody(subjectId: string, body: string, tx?: PrismaLike): Promise<Question | null>;
  create(input: CreateQuestionInput, tx?: PrismaLike): Promise<Question>;
  createMany(inputs: CreateQuestionInput[], tx?: PrismaLike): Promise<void>;
  update(id: string, input: UpdateQuestionInput, tx?: PrismaLike): Promise<Question>;
  delete(id: string, tx?: PrismaLike): Promise<void>;
}

export class QuestionRepository implements IQuestionRepository {
  async findAll(filter?: QuestionFilter, limit = 500, tx?: PrismaLike): Promise<Question[]> {
    const prisma = tx ?? getPrisma();
    return prisma.question.findMany({
      where: filter?.subjectId ? { subjectId: filter.subjectId } : undefined,
      take: limit,
    });
  }

  async findById(id: string, tx?: PrismaLike): Promise<Question | null> {
    const prisma = tx ?? getPrisma();
    return prisma.question.findUnique({ where: { id } });
  }

  async findManyByIds(ids: string[], tx?: PrismaLike): Promise<Question[]> {
    // 空配列なら DB を叩かずに早期 return (Prisma `in: []` は無駄クエリになるため)
    if (ids.length === 0) return [];
    const prisma = tx ?? getPrisma();
    return prisma.question.findMany({
      where: { id: { in: ids } },
    });
  }

  async findBySubjectAndBody(
    subjectId: string,
    body: string,
    tx?: PrismaLike
  ): Promise<Question | null> {
    const prisma = tx ?? getPrisma();
    return prisma.question.findFirst({ where: { subjectId, body } });
  }

  async create(input: CreateQuestionInput, tx?: PrismaLike): Promise<Question> {
    const prisma = tx ?? getPrisma();
    return prisma.question.create({
      data: {
        subjectId: input.subjectId,
        body: input.body,
        choices: input.choices,
        correctIndex: input.correctIndex,
        explanation: input.explanation,
      },
    });
  }

  async createMany(inputs: CreateQuestionInput[], tx?: PrismaLike): Promise<void> {
    // Prisma.createMany は JSON 型をサポートしないため、loop で create する。
    // 呼び出し側で $transaction にまとめて all-or-nothing を担保する。
    for (const input of inputs) {
      await this.create(input, tx);
    }
  }

  async update(id: string, input: UpdateQuestionInput, tx?: PrismaLike): Promise<Question> {
    const prisma = tx ?? getPrisma();
    return prisma.question.update({ where: { id }, data: input });
  }

  async delete(id: string, tx?: PrismaLike): Promise<void> {
    const prisma = tx ?? getPrisma();
    await prisma.question.delete({ where: { id } });
  }
}
