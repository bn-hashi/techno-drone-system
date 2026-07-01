import { describe, it, expect, beforeEach, vi } from "vitest";
import { DashboardRepository } from "@/repositories/dashboardRepository";
import { UserRole, UserStatus } from "@/types/prisma";

const mockUserGroupBy = vi.fn();
const mockApplicationCount = vi.fn();
const mockFraudFlagCount = vi.fn();
const mockQaRecordCount = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    user: { groupBy: mockUserGroupBy },
    enrollmentApplication: { count: mockApplicationCount },
    fraudFlag: { count: mockFraudFlagCount },
    qARecord: { count: mockQaRecordCount },
  }),
}));

describe("DashboardRepository", () => {
  let repository: DashboardRepository;

  beforeEach(() => {
    mockUserGroupBy.mockReset();
    mockApplicationCount.mockReset();
    mockFraudFlagCount.mockReset();
    mockQaRecordCount.mockReset();
    repository = new DashboardRepository();
  });

  const setupUserGroupByStatus = (counts: Partial<Record<UserStatus, number>>) => {
    const groups = (Object.entries(counts) as [UserStatus, number][]).map(([status, count]) => ({
      status,
      _count: { _all: count },
    }));
    mockUserGroupBy.mockResolvedValue(groups);
  };

  describe("getStats", () => {
    it("test_getStats_returns_student_counts_by_status", async () => {
      // Arrange
      setupUserGroupByStatus({
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

    it("test_getStats_queries_user_groupBy_with_STUDENT_role", async () => {
      // Arrange
      setupUserGroupByStatus({});
      mockApplicationCount.mockResolvedValue(0);
      mockFraudFlagCount.mockResolvedValue(0);
      mockQaRecordCount.mockResolvedValue(0);

      // Act
      await repository.getStats();

      // Assert
      expect(mockUserGroupBy).toHaveBeenCalledWith({
        by: ["status"],
        where: { role: UserRole.STUDENT },
        _count: { _all: true },
      });
    });

    it("test_getStats_returns_pending_application_count", async () => {
      // Arrange
      setupUserGroupByStatus({});
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
      setupUserGroupByStatus({});
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
      setupUserGroupByStatus({});
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
      setupUserGroupByStatus({});
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
      setupUserGroupByStatus({});
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
      setupUserGroupByStatus({});
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
      setupUserGroupByStatus({});
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
