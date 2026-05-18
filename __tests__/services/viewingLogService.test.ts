import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { ViewingLogService } from "@/services/viewingLogService";
import type { IViewingLogRepository } from "@/repositories/viewingLogRepository";
import type { IVideoRepository } from "@/repositories/videoRepository";
import { BusinessError, VideoNotFoundError } from "@/services/errors";

describe("ViewingLogService", () => {
  let service: ViewingLogService;
  let mockLogRepo: Mocked<IViewingLogRepository>;
  let mockVideoRepo: Mocked<IVideoRepository>;

  const mockVideo = {
    id: "video-1",
    title: "ドローン基礎",
    description: null,
    subjectId: "subject-1",
    courseId: "course-1",
    filePath: "/videos/basic.mp4",
    duration: 3600,
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validInput = {
    userId: "user-1",
    videoId: "video-1",
    startedAt: new Date("2026-05-18T10:00:00Z"),
    endedAt: new Date("2026-05-18T10:00:10Z"),
    watchedSeconds: 10,
  };

  const mockLog = { id: "log-1", ...validInput, rawLog: null, createdAt: new Date() };

  beforeEach(() => {
    mockLogRepo = {
      create: vi.fn(),
      findMaxWatchedSecondsByUserVideo: vi.fn(),
    } as Mocked<IViewingLogRepository>;

    mockVideoRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByIdWithSupervisors: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as Mocked<IVideoRepository>;

    service = new ViewingLogService(mockLogRepo, mockVideoRepo);
  });

  describe("recordSession", () => {
    it("test_recordSession_valid_input_returns_created_log", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockLogRepo.create.mockResolvedValue(mockLog);

      const result = await service.recordSession(validInput);

      expect(result).toEqual(mockLog);
    });

    it("test_recordSession_video_not_found_throws_VideoNotFoundError", async () => {
      mockVideoRepo.findById.mockResolvedValue(null);

      await expect(service.recordSession(validInput)).rejects.toThrow(VideoNotFoundError);
    });

    it("test_recordSession_watchedSeconds_exceeds_duration_throws_BusinessError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await expect(
        service.recordSession({ ...validInput, watchedSeconds: 5000 })
      ).rejects.toThrow(BusinessError);
    });

    it("test_recordSession_negative_watchedSeconds_throws_BusinessError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await expect(
        service.recordSession({ ...validInput, watchedSeconds: -1 })
      ).rejects.toThrow(BusinessError);
    });

    it("test_recordSession_startedAt_after_endedAt_throws_BusinessError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await expect(
        service.recordSession({
          ...validInput,
          startedAt: new Date("2026-05-18T10:00:10Z"),
          endedAt: new Date("2026-05-18T10:00:00Z"),
        })
      ).rejects.toThrow(BusinessError);
    });
  });

  describe("getMaxWatchedSeconds", () => {
    it("test_getMaxWatchedSeconds_delegates_to_repo", async () => {
      mockLogRepo.findMaxWatchedSecondsByUserVideo.mockResolvedValue(120);

      const result = await service.getMaxWatchedSeconds("user-1", "video-1");

      expect(result).toBe(120);
    });
  });
});
