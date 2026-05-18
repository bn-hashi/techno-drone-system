import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { ProgressService } from "@/services/progressService";
import type { IViewingLogRepository } from "@/repositories/viewingLogRepository";
import type { IVideoRepository } from "@/repositories/videoRepository";
import type { ISubjectRepository } from "@/repositories/subjectRepository";
import { CourseType } from "@/types/prisma";

describe("ProgressService", () => {
  let service: ProgressService;
  let mockLogRepo: Mocked<IViewingLogRepository>;
  let mockVideoRepo: Mocked<IVideoRepository>;
  let mockSubjectRepo: Mocked<ISubjectRepository>;

  const subject1 = {
    id: "subject-1",
    code: "SUBJECT_01",
    name: "ドローン基礎",
    requiredMinutesBeginner: 180,
    requiredMinutesExperienced: 60,
  };

  const subject2 = {
    id: "subject-2",
    code: "SUBJECT_02",
    name: "操縦法規",
    requiredMinutesBeginner: 210,
    requiredMinutesExperienced: 90,
  };

  const video1 = {
    id: "video-1",
    title: "v1",
    description: null,
    subjectId: "subject-1",
    courseId: "course-1",
    filePath: "/v1.mp4",
    duration: 600,
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const video2 = {
    id: "video-2",
    title: "v2",
    description: null,
    subjectId: "subject-1",
    courseId: "course-1",
    filePath: "/v2.mp4",
    duration: 600,
    sortOrder: 1,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockLogRepo = {
      create: vi.fn(),
      findMaxWatchedSecondsByUserVideo: vi.fn(),
      findMaxWatchedSecondsByUserVideos: vi.fn(),
      findLatestCreatedAtByUserVideo: vi.fn(),
      sumWatchedSecondsByUserSubject: vi.fn(),
    } as Mocked<IViewingLogRepository>;

    mockVideoRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByIdWithSupervisors: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as Mocked<IVideoRepository>;

    mockSubjectRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      updateRequiredMinutes: vi.fn(),
    } as Mocked<ISubjectRepository>;

    service = new ProgressService(mockLogRepo, mockVideoRepo, mockSubjectRepo);
  });

  describe("getProgressByUser", () => {
    it("test_getProgress_returns_all_subjects", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1, subject2]);
      mockLogRepo.sumWatchedSecondsByUserSubject.mockResolvedValue(0);

      const result = await service.getProgressByUser("user-1", CourseType.BEGINNER);

      expect(result).toHaveLength(2);
    });

    it("test_getProgress_uses_beginner_required_for_beginner_courseType", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);
      mockLogRepo.sumWatchedSecondsByUserSubject.mockResolvedValue(0);

      const result = await service.getProgressByUser("user-1", CourseType.BEGINNER);

      expect(result[0].requiredMinutes).toBe(180);
    });

    it("test_getProgress_uses_experienced_required_for_experienced_courseType", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);
      mockLogRepo.sumWatchedSecondsByUserSubject.mockResolvedValue(0);

      const result = await service.getProgressByUser("user-1", CourseType.EXPERIENCED);

      expect(result[0].requiredMinutes).toBe(60);
    });

    it("test_getProgress_converts_seconds_to_minutes_floor", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);
      // 119 秒 = 1.98 分 → floor = 1 分
      mockLogRepo.sumWatchedSecondsByUserSubject.mockResolvedValue(119);

      const result = await service.getProgressByUser("user-1", CourseType.BEGINNER);

      expect(result[0].totalWatchedMinutes).toBe(1);
    });

    it("test_getProgress_isFulfilled_true_when_threshold_met", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);
      // 180 分 = 10800 秒 ちょうど
      mockLogRepo.sumWatchedSecondsByUserSubject.mockResolvedValue(10800);

      const result = await service.getProgressByUser("user-1", CourseType.BEGINNER);

      expect(result[0].isFulfilled).toBe(true);
    });

    it("test_getProgress_isFulfilled_false_when_below_threshold", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([subject1]);
      mockLogRepo.sumWatchedSecondsByUserSubject.mockResolvedValue(10799);

      const result = await service.getProgressByUser("user-1", CourseType.BEGINNER);

      expect(result[0].isFulfilled).toBe(false);
    });
  });

  describe("canWatchVideo", () => {
    it("test_canWatchVideo_first_video_always_returns_true", async () => {
      mockVideoRepo.findById.mockResolvedValue(video1); // sortOrder=0
      mockVideoRepo.findAll.mockResolvedValue([]);

      const result = await service.canWatchVideo("user-1", "video-1");

      expect(result).toBe(true);
    });

    it("test_canWatchVideo_returns_false_when_video_not_found", async () => {
      mockVideoRepo.findById.mockResolvedValue(null);

      const result = await service.canWatchVideo("user-1", "video-x");

      expect(result).toBe(false);
    });

    it("test_canWatchVideo_returns_true_when_previous_video_completed", async () => {
      mockVideoRepo.findById.mockResolvedValue(video2);
      mockVideoRepo.findAll.mockResolvedValue([video1]);
      // 600 秒 * 0.8 = 480 秒以上見ている
      mockLogRepo.findMaxWatchedSecondsByUserVideos.mockResolvedValue({ "video-1": 500 });

      const result = await service.canWatchVideo("user-1", "video-2");

      expect(result).toBe(true);
    });

    it("test_canWatchVideo_returns_false_when_previous_video_not_completed", async () => {
      mockVideoRepo.findById.mockResolvedValue(video2);
      mockVideoRepo.findAll.mockResolvedValue([video1]);
      // 600 秒 * 0.8 = 480 秒未満
      mockLogRepo.findMaxWatchedSecondsByUserVideos.mockResolvedValue({ "video-1": 400 });

      const result = await service.canWatchVideo("user-1", "video-2");

      expect(result).toBe(false);
    });
  });

  describe("canWatchVideoBatch", () => {
    it("test_canWatchVideoBatch_returns_map_per_videoId", async () => {
      mockVideoRepo.findAll.mockResolvedValue([video1, video2]);
      // video1 を 80% 視聴済み、video2 は未視聴
      mockLogRepo.findMaxWatchedSecondsByUserVideos.mockResolvedValue({
        "video-1": 500,
      });

      const result = await service.canWatchVideoBatch("user-1", [video1, video2]);

      expect(result["video-1"]).toBe(true);
    });

    it("test_canWatchVideoBatch_locks_second_when_first_not_completed", async () => {
      mockVideoRepo.findAll.mockResolvedValue([video1, video2]);
      // video1 未完了
      mockLogRepo.findMaxWatchedSecondsByUserVideos.mockResolvedValue({
        "video-1": 100,
      });

      const result = await service.canWatchVideoBatch("user-1", [video1, video2]);

      expect(result["video-2"]).toBe(false);
    });

    it("test_canWatchVideoBatch_calls_findMaxByVideos_once", async () => {
      mockVideoRepo.findAll.mockResolvedValue([video1, video2]);
      mockLogRepo.findMaxWatchedSecondsByUserVideos.mockResolvedValue({});

      await service.canWatchVideoBatch("user-1", [video1, video2]);

      // N+1 解消: 動画数によらず DB 呼び出しは 1 回のみ
      expect(mockLogRepo.findMaxWatchedSecondsByUserVideos).toHaveBeenCalledTimes(1);
    });
  });
});
