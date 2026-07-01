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

    const [userGroups, pendingApplications, unresolvedFraudFlags, unansweredQAs] =
      await Promise.all([
        prisma.user.groupBy({
          by: ["status"],
          where: { role: UserRole.STUDENT },
          _count: { _all: true },
        }),
        prisma.enrollmentApplication.count({ where: { acceptedAt: null } }),
        prisma.fraudFlag.count({ where: { resolvedAt: null } }),
        prisma.qARecord.count({ where: { answer: null } }),
      ]);

    const countByStatus = (status: UserStatus): number =>
      userGroups.find((g) => g.status === status)?._count._all ?? 0;

    return {
      studentsByStatus: {
        pendingRegistration: countByStatus(UserStatus.PENDING_REGISTRATION),
        pendingActivation: countByStatus(UserStatus.PENDING_ACTIVATION),
        active: countByStatus(UserStatus.ACTIVE),
        examPassed: countByStatus(UserStatus.EXAM_PASSED),
        completed: countByStatus(UserStatus.COMPLETED),
        certified: countByStatus(UserStatus.CERTIFIED),
        dipsLinked: countByStatus(UserStatus.DIPS_LINKED),
      },
      pendingApplications,
      unresolvedFraudFlags,
      unansweredQAs,
    };
  }
}
