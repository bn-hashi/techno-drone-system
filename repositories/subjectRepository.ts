import { getPrisma } from "@/lib/db";
import { Subject } from "@prisma/client";

export interface ISubjectRepository {
  findAll(): Promise<Subject[]>;
  findById(id: string): Promise<Subject | null>;
  updateRequiredMinutes(id: string, beginner: number, experienced: number): Promise<Subject>;
}

export class SubjectRepository implements ISubjectRepository {
  async findAll(): Promise<Subject[]> {
    const prisma = getPrisma();
    return prisma.subject.findMany();
  }

  async findById(id: string): Promise<Subject | null> {
    const prisma = getPrisma();
    return prisma.subject.findUnique({ where: { id } });
  }

  async updateRequiredMinutes(
    id: string,
    beginner: number,
    experienced: number
  ): Promise<Subject> {
    const prisma = getPrisma();
    return prisma.subject.update({
      where: { id },
      data: { requiredMinutesBeginner: beginner, requiredMinutesExperienced: experienced },
    });
  }
}
