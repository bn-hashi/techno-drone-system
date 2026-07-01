import { describe, it, expect, beforeEach, vi } from "vitest";
import { DashboardRepository } from "@/repositories/dashboardRepository";
import { UserRole, UserStatus } from "@/types/prisma";

const mockUserCount = vi.fn();
const mockApplicationCount = vi.fn();
const mockFraudFlagCount = vi.fn();
const mockQaRecordCount = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    user: { count: mockUserCount },
    enrollmentApplication: { count: mockApplicationCount },
    fraudFlag: { count: mockFraudFlagCount },
    qARecord: { count: mockQaRecordCount },
  }),
}));

describe("DashboardRepository", () => {
  let repository: DashboardRepository;

  beforeEach(() => {
    mockUserCount.mockReset();
    mockApplicationCount.mockReset();
    mockFraudFlagCount.mockReset();
    mockQaRecordCount.mockReset();
    repository = new DashboardRepository();
  });

  const setupUserCountByStatus = (counts: Partial<Record<UserStatus, number>>) => {
    mockUserCount.mockImplementation(({ where }: { where: { role: string; status: UserStatus } }) =>
      Promise.resolve(counts[where.status] ?? 0)
    );
  };

  describe("getStats", () => {
    it("test_getStats_returns_student_counts_by_status", async () => {
      // Arrange
      setupUserCountByStatus({
        [UserStatus.PENDING_REGISTRATION]: 3,
        [UserStatus.PENDING_ACTIVATION]: 2,
        [UserStatus.ACTIVE]: 10,
        [UserStatus.EXAM_PASSED]: 4,
        [UserStatus.COMPLETED]: 5,
        [UserStatus.CERTIFIED]: 6,
        [UserStatus.DIPS_LINKED]: 1,
      });
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      const result = await repository.getStats();

      // Assert
      expect(result.studentsByStatus).toEqual({
        pendingRegistration: 3,
        pendingActivation: 2,
        active: 10,
        examPassed: 4,
        completed: 5,
        certified: 6,
        dipsLinked: 1,
      });
    });

    it("test_getStats_queries_user_count_with_STUDENT_role_and_status", async () => {
      // Arrange
      setupUserCountByStatus({});
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      await repository.getStats();

      // Assert
      expect(mockUserCount).toHaveBeenCalledWith({
        where: { role: UserRole.STUDENT, status: UserStatus.ACTIVE },
      });
      expect(mockUserCount).toHaveBeenCalledWith({
        where: { role: UserRole.STUDENT, status: UserStatus.PENDING_REGISTRATION },
      });
    });

    it("test_getStats_returns_pending_application_count", async () => {
      // Arrange
      setupUserCountByStatus({});
      mockApplicationCount.mockResolvedValue(7);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      const result = await repository.getStats();

      // Assert
      expect(result.pendingApplications).toBe(7);
    });

    it("test_getStats_queries_applications_where_acceptedAt_is_null", async () => {
      // Arrange
      setupUserCountByStatus({});
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      await repository.getStats();

      // Assert
      expect(mockApplicationCount).toHaveBeenCalledWith({ where: { acceptedAt: null } });
    });

    it("test_getStats_returns_unresolved_fraud_flag_count", async () => {
      // Arrange
      setupUserCountByStatus({});
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(5);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      const result = await repository.getStats();

      // Assert
      expect(result.unresolvedFraudFlags).toBe(5);
    });

    it("test_getStats_queries_fraud_flags_where_resolvedAt_is_null", async () => {
      // Arrange
      setupUserCountByStatus({});
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      await repository.getStats();

      // Assert
      expect(mockFraudFlagCount).toHaveBeenCalledWith({ where: { resolvedAt: null } });
    });

    it("test_getStats_returns_unanswered_qa_count", async () => {
      // Arrange
      setupUserCountByStatus({});
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(3);

      // Act
      const result = await repository.getStats();

      // Assert
      expect(result.unansweredQAs).toBe(3);
    });

    it("test_getStats_queries_qa_records_where_answer_is_null", async () => {
      // Arrange
      setupUserCountByStatus({});
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      await repository.getStats();

      // Assert
      expect(mockQaRecordCount).toHaveBeenCalledWith({ where: { answer: null } });
    });

    it("test_getStats_returns_zero_counts_when_no_data", async () => {
      // Arrange
      setupUserCountByStatus({});
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      const result = await repository.getStats();

      // Assert
      expect(result).toEqual({
        studentsByStatus: {
          pendingRegistration: 0,
          pendingActivation: 0,
          active: 0,
          examPassed: 0,
          completed: 0,
          certified: 0,
          dipsLinked: 0,
        },
        pendingApplications: 0,
        unresolvedFraudFlags: 0,
        unansweredQAs: 0,
      });
    });
  });
});
