import { getPrisma } from "@/lib/db";
import { UserRole, UserStatus } from "@/types/prisma";

export interface DashboardStats {
  studentsByStatus: {
    pendingRegistration: number;
    pendingActivation: number;
    active: number;
    examPassed: number;
    completed: number;
    certified: number;
    dipsLinked: number;
  };
  pendingApplications: number;
  unresolvedFraudFlags: number;
  unansweredQAs: number;
}

export interface IDashboardRepository {
  getStats(): Promise<DashboardStats>;
}

export class DashboardRepository implements IDashboardRepository {
  async getStats(): Promise<DashboardStats> {
    const prisma = getPrisma();

    const [
      pendingRegistration,
      pendingActivation,
      active,
      examPassed,
      completed,
      certified,
      dipsLinked,
      pendingApplications,
      unresolvedFraudFlags,
      unansweredQAs,
    ] = await Promise.all([
      prisma.user.count({
        where: { role: UserRole.STUDENT, status: UserStatus.PENDING_REGISTRATION },
      }),
      prisma.user.count({
        where: { role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION },
      }),
      prisma.user.count({
        where: { role: UserRole.STUDENT, status: UserStatus.ACTIVE },
      }),
      prisma.user.count({
        where: { role: UserRole.STUDENT, status: UserStatus.EXAM_PASSED },
      }),
      prisma.user.count({
        where: { role: UserRole.STUDENT, status: UserStatus.COMPLETED },
      }),
      prisma.user.count({
        where: { role: UserRole.STUDENT, status: UserStatus.CERTIFIED },
      }),
      prisma.user.count({
        where: { role: UserRole.STUDENT, status: UserStatus.DIPS_LINKED },
      }),
      prisma.enrollmentApplication.count({ where: { acceptedAt: null } }),
      prisma.fraudFlag.count({ where: { resolvedAt: null } }),
      prisma.qARecord.count({ where: { answer: null } }),
    ]);

    return {
      studentsByStatus: {
        pendingRegistration,
        pendingActivation,
        active,
        examPassed,
        completed,
        certified,
        dipsLinked,
      },
      pendingApplications,
      unresolvedFraudFlags,
      unansweredQAs,
    };
  }
}
