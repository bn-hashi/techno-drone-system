import { getPrisma } from "@/lib/db";
import { EnrollmentApplication, User } from "@prisma/client";
import { UserStatus } from "@/types/prisma";

export type EnrollmentApplicationListItem = {
  id: string;
  user: Pick<User, "name" | "email">;
  applicationDate: Date;
  acceptedAt: Date | null;
  hasIdDocument: boolean;
  hasPhoto: boolean;
  hasExperienceCert: boolean;
};

export interface IEnrollmentApplicationRepository {
  findByUserId(userId: string): Promise<EnrollmentApplication | null>;
  findById(id: string): Promise<EnrollmentApplication | null>;
  findAll(): Promise<EnrollmentApplicationListItem[]>;
  create(data: {
    userId: string;
    dateOfBirth: Date;
    address: string;
    phoneNumber: string;
  }): Promise<EnrollmentApplication>;
  update(
    id: string,
    data: Partial<
      Pick<
        EnrollmentApplication,
        "idDocumentPath" | "photoPath" | "experienceCertPath" | "acceptedAt"
      >
    >
  ): Promise<EnrollmentApplication>;
  // 申請受理とユーザーステータス遷移を1トランザクションでアトミックに実行する
  accept(applicationId: string, userId: string): Promise<EnrollmentApplication>;
}

export class EnrollmentApplicationRepository implements IEnrollmentApplicationRepository {
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

  async findAll(): Promise<EnrollmentApplicationListItem[]> {
    const prisma = getPrisma();
    const records = await prisma.enrollmentApplication.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { applicationDate: "desc" },
    });
    return records.map((record) => ({
      id: record.id,
      user: record.user,
      applicationDate: record.applicationDate,
      acceptedAt: record.acceptedAt,
      hasIdDocument: record.idDocumentPath !== null,
      hasPhoto: record.photoPath !== null,
      hasExperienceCert: record.experienceCertPath !== null,
    }));
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
    data: Partial<
      Pick<
        EnrollmentApplication,
        "idDocumentPath" | "photoPath" | "experienceCertPath" | "acceptedAt"
      >
    >
  ): Promise<EnrollmentApplication> {
    const prisma = getPrisma();
    return prisma.enrollmentApplication.update({
      where: { id },
      data,
    });
  }

  async accept(applicationId: string, userId: string): Promise<EnrollmentApplication> {
    const prisma = getPrisma();
    const [updated] = await prisma.$transaction([
      prisma.enrollmentApplication.update({
        where: { id: applicationId },
        data: { acceptedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.PENDING_ACTIVATION },
      }),
    ]);
    return updated;
  }
}
