import { describe, it, expect, beforeEach, vi } from "vitest";
import { ViewingLogRepository } from "@/repositories/viewingLogRepository";

const mockCreate = vi.fn();
const mockAggregate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    viewingLog: {
      create: mockCreate,
      aggregate: mockAggregate,
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
});
