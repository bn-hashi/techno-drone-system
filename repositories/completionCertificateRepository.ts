import { getPrisma } from "@/lib/db";
import { CompletionCertificate, Prisma } from "@prisma/client";

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface CreateCompletionCertificateInput {
  userId: string;
  certificateNumber: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface ICompletionCertificateRepository {
  findByUser(userId: string, tx?: PrismaLike): Promise<CompletionCertificate | null>;
  findByNumber(certificateNumber: string, tx?: PrismaLike): Promise<CompletionCertificate | null>;
  /**
   * JST 換算で指定年月 (year, month=1-12) に発行された証明書の件数を返す。
   * 採番ルールの「同月内連番」を計算するために使用する。
   */
  countByMonth(year: number, month: number, tx?: PrismaLike): Promise<number>;
  create(
    input: CreateCompletionCertificateInput,
    tx?: PrismaLike
  ): Promise<CompletionCertificate>;
  updatePdfPath(
    id: string,
    pdfPath: string,
    tx?: PrismaLike
  ): Promise<CompletionCertificate>;
}

/**
 * JST 換算で year, month (1-12) の月初〜翌月初を UTC Date で返す
 */
function jstMonthRange(year: number, month: number): { gte: Date; lt: Date } {
  // JST = UTC + 9h なので JST 00:00 は UTC の前日 15:00
  // 月初 (JST): year-month-01 00:00:00 → UTC: year-(month-1)-末日 15:00:00
  // 翌月初 (JST): year-(month+1)-01 00:00:00 → UTC: year-month-末日 15:00:00
  // JavaScript Date は UTC で構築するため、JST 月初 UTC = Date.UTC(year, month-1, 1) - 9h
  const gte = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0));
  const lt = new Date(Date.UTC(year, month, 1, -9, 0, 0));
  return { gte, lt };
}

export class CompletionCertificateRepository implements ICompletionCertificateRepository {
  async findByUser(
    userId: string,
    tx?: PrismaLike
  ): Promise<CompletionCertificate | null> {
    const prisma = tx ?? getPrisma();
    return prisma.completionCertificate.findUnique({ where: { userId } });
  }

  async findByNumber(
    certificateNumber: string,
    tx?: PrismaLike
  ): Promise<CompletionCertificate | null> {
    const prisma = tx ?? getPrisma();
    return prisma.completionCertificate.findUnique({ where: { certificateNumber } });
  }

  async countByMonth(year: number, month: number, tx?: PrismaLike): Promise<number> {
    const prisma = tx ?? getPrisma();
    const { gte, lt } = jstMonthRange(year, month);
    return prisma.completionCertificate.count({
      where: { issuedAt: { gte, lt } },
    });
  }

  async create(
    input: CreateCompletionCertificateInput,
    tx?: PrismaLike
  ): Promise<CompletionCertificate> {
    const prisma = tx ?? getPrisma();
    return prisma.completionCertificate.create({
      data: {
        userId: input.userId,
        certificateNumber: input.certificateNumber,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
      },
    });
  }

  async updatePdfPath(
    id: string,
    pdfPath: string,
    tx?: PrismaLike
  ): Promise<CompletionCertificate> {
    const prisma = tx ?? getPrisma();
    return prisma.completionCertificate.update({
      where: { id },
      data: { pdfPath },
    });
  }
}
