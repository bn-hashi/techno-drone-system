import { describe, it, expect, beforeEach, vi } from "vitest";
import { ViewingLogRepository } from "@/repositories/viewingLogRepository";

const mockCreate = vi.fn();
const mockAggregate = vi.fn();

const mockFindFirst = vi.fn();
const mockGroupBy = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    viewingLog: {
      create: mockCreate,
      aggregate: mockAggregate,
      findFirst: mockFindFirst,
      groupBy: mockGroupBy,
    },
    video: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }),
}));

describe("ViewingLogRepository", () => {
  let repository: ViewingLogRepository;

  const createInput = {
    userId: "user-1",
    videoId: "video-1",
    startedAt: new Date("2026-05-18T10:00:00Z"),
    endedAt: new Date("2026-05-18T10:00:10Z"),
    watchedSeconds: 10,
  };

  const mockLog = {
    id: "log-1",
    ...createInput,
    rawLog: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockCreate.mockReset();
    mockAggregate.mockReset();
    mockFindFirst.mockReset();
    mockGroupBy.mockReset();
    repository = new ViewingLogRepository();
  });

  describe("create", () => {
    it("test_create_returns_created_log", async () => {
      mockCreate.mockResolvedValue(mockLog);

      const result = await repository.create(createInput);

      expect(result).toEqual(mockLog);
    });

    it("test_create_passes_input_to_prisma", async () => {
      mockCreate.mockResolvedValue(mockLog);

      await repository.create(createInput);

      expect(mockCreate).toHaveBeenCalledWith({ data: createInput });
    });
  });

  describe("findMaxWatchedSecondsByUserVideo", () => {
    it("test_findMax_returns_aggregate_max_value", async () => {
      mockAggregate.mockResolvedValue({ _max: { watchedSeconds: 120 } });

      const result = await repository.findMaxWatchedSecondsByUserVideo("user-1", "video-1");

      expect(result).toBe(120);
    });

    it("test_findMax_returns_zero_when_no_logs", async () => {
      mockAggregate.mockResolvedValue({ _max: { watchedSeconds: null } });

      const result = await repository.findMaxWatchedSecondsByUserVideo("user-1", "video-1");

      expect(result).toBe(0);
    });

    it("test_findMax_calls_prisma_with_user_and_video", async () => {
      mockAggregate.mockResolvedValue({ _max: { watchedSeconds: 0 } });

      await repository.findMaxWatchedSecondsByUserVideo("user-1", "video-1");

      expect(mockAggregate).toHaveBeenCalledWith({
        where: { userId: "user-1", videoId: "video-1" },
        _max: { watchedSeconds: true },
      });
    });
  });

  describe("findLatestCreatedAtByUserVideo", () => {
    it("test_findLatestCreatedAt_returns_createdAt", async () => {
      const createdAt = new Date("2026-05-18T10:00:00Z");
      mockFindFirst.mockResolvedValue({ createdAt });

      const result = await repository.findLatestCreatedAtByUserVideo("user-1", "video-1");

      expect(result).toEqual(createdAt);
    });

    it("test_findLatestCreatedAt_returns_null_when_no_logs", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await repository.findLatestCreatedAtByUserVideo("user-1", "video-1");

      expect(result).toBeNull();
    });

    it("test_findLatestCreatedAt_orders_by_createdAt_desc", async () => {
      mockFindFirst.mockResolvedValue(null);

      await repository.findLatestCreatedAtByUserVideo("user-1", "video-1");

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", videoId: "video-1" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
    });
  });

  describe("sumWatchedSecondsByUserSubject", () => {
    it("test_sumWatchedSecondsByUserSubject_returns_sum_of_max_per_video", async () => {
      // 2 動画分の max を合計する: 60 + 120 = 180
      mockGroupBy.mockResolvedValue([
        { videoId: "video-1", _max: { watchedSeconds: 60 } },
        { videoId: "video-2", _max: { watchedSeconds: 120 } },
      ]);

      const result = await repository.sumWatchedSecondsByUserSubject("user-1", "subject-1");

      expect(result).toBe(180);
    });

    it("test_sumWatchedSecondsByUserSubject_returns_zero_when_no_logs", async () => {
      mockGroupBy.mockResolvedValue([]);

      const result = await repository.sumWatchedSecondsByUserSubject("user-1", "subject-1");

      expect(result).toBe(0);
    });

    it("test_sumWatchedSecondsByUserSubject_groups_by_videoId_and_filters_by_subject", async () => {
      mockGroupBy.mockResolvedValue([]);

      await repository.sumWatchedSecondsByUserSubject("user-1", "subject-1");

      expect(mockGroupBy).toHaveBeenCalledWith({
        by: ["videoId"],
        where: { userId: "user-1", video: { subjectId: "subject-1" } },
        _max: { watchedSeconds: true },
      });
    });
  });
});
