import { getPrisma } from "@/lib/db";
import { EnrollmentApplication } from "@prisma/client";

export interface IEnrollmentApplicationRepository {
  findByUserId(userId: string): Promise<EnrollmentApplication | null>;
  findById(id: string): Promise<EnrollmentApplication | null>;
  create(data: {
    userId: string;
    dateOfBirth: Date;
    address: string;
    phoneNumber: string;
  }): Promise<EnrollmentApplication>;
  update(
    id: string,
    data: Partial<Pick<EnrollmentApplication, "idDocumentPath" | "photoPath" | "experienceCertPath" | "acceptedAt">>
  ): Promise<EnrollmentApplication>;
}

export class EnrollmentApplicationRepository
  implements IEnrollmentApplicationRepository
{
  async findByUserId(userId: string): Promise<EnrollmentApplication | null> {
    const prisma = getPrisma();
    return prisma.enrollmentApplication.findUnique({
      where: { userId },
    });
  }

  async findById(id: string): Promise<EnrollmentApplication | null> {
    const prisma = getPrisma();
    return prisma.enrollmentApplication.findUnique({
      where: { id },
    });
  }

  async create(data: {
    userId: string;
    dateOfBirth: Date;
    address: string;
    phoneNumber: string;
  }): Promise<EnrollmentApplication> {
    const prisma = getPrisma();
    return prisma.enrollmentApplication.create({ data });
  }

  async update(
    id: string,
    data: Partial<Pick<EnrollmentApplication, "idDocumentPath" | "photoPath" | "experienceCertPath" | "acceptedAt">>
  ): Promise<EnrollmentApplication> {
    const prisma = getPrisma();
    return prisma.enrollmentApplication.update({
      where: { id },
      data,
    });
  }
}
