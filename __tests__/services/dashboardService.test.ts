import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mocked } from "vitest";
import { DashboardService } from "@/services/dashboardService";
import type { IDashboardRepository, DashboardStats } from "@/repositories/dashboardRepository";

const makeStats = (overrides: Partial<DashboardStats> = {}): DashboardStats => ({
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
  ...overrides,
});

describe("DashboardService", () => {
  let mockRepo: Mocked<IDashboardRepository>;
  let service: DashboardService;

  beforeEach(() => {
    mockRepo = {
      getStats: vi.fn(),
    } as Mocked<IDashboardRepository>;
    service = new DashboardService(mockRepo);
  });

  describe("getStats", () => {
    it("test_getStats_delegates_to_repository", async () => {
      // Arrange
      const expectedStats = makeStats({ pendingApplications: 5 });
      mockRepo.getStats.mockResolvedValue(expectedStats);

      // Act
      await service.getStats();

      // Assert
      expect(mockRepo.getStats).toHaveBeenCalledOnce();
    });

    it("test_getStats_returns_repository_result_unchanged", async () => {
      // Arrange
      const stats = makeStats({
        studentsByStatus: {
          pendingRegistration: 3,
          pendingActivation: 2,
          active: 10,
          examPassed: 4,
          completed: 5,
          certified: 6,
          dipsLinked: 1,
        },
        pendingApplications: 7,
        unresolvedFraudFlags: 5,
        unansweredQAs: 3,
      });
      mockRepo.getStats.mockResolvedValue(stats);

      // Act
      const result = await service.getStats();

      // Assert
      expect(result).toEqual(stats);
    });
  });
});
