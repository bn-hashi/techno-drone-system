import type { Subject } from "@prisma/client";
import type { ISubjectRepository } from "@/repositories/subjectRepository";
import { BusinessError, SubjectNotFoundError } from "@/services/errors";

export class SubjectService {
  constructor(private readonly subjectRepo: ISubjectRepository) {}

  async listSubjects(): Promise<Subject[]> {
    return this.subjectRepo.findAll();
  }

  async updateRequiredMinutes(
    id: string,
    beginner: number,
    experienced: number
  ): Promise<Subject> {
    if (beginner < 0 || experienced < 0) {
      throw new BusinessError("必要時間は0以上の値を指定してください");
    }

    const subject = await this.subjectRepo.findById(id);
    if (subject === null) {
      throw new SubjectNotFoundError(id);
    }

    return this.subjectRepo.updateRequiredMinutes(id, beginner, experienced);
  }
}
