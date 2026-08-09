import { describe, it, expect, beforeEach, afterEach, vi, type Mocked } from "vitest";

// runTransaction はコールバックをそのまま実行する Mock にする
// (Repository への tx 注入経路はテストで透過的になる)
vi.mock("@/lib/db", () => ({
  runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
}));

import { ViewingLogService } from "@/services/viewingLogService";
import type { IViewingLogRepository } from "@/repositories/viewingLogRepository";
import type { IVideoRepository } from "@/repositories/videoRepository";
import type { ISubjectProgressRepository } from "@/repositories/subjectProgressRepository";
import type { ICourseAccessService } from "@/services/courseAccessService";
import { BusinessError, VideoNotFoundError } from "@/services/errors";

describe("ViewingLogService", () => {
  let service: ViewingLogService;
  let mockLogRepo: Mocked<IViewingLogRepository>;
  let mockVideoRepo: Mocked<IVideoRepository>;
  let mockSubjectProgressRepo: Mocked<ISubjectProgressRepository>;
  let mockCourseAccessService: Mocked<ICourseAccessService>;
  let mockWatchChecker: { canWatchVideo: ReturnType<typeof vi.fn> };

  // テスト中のサーバー現在時刻を固定する基準
  const NOW = new Date("2026-05-18T10:00:30.000Z");

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
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mockLogRepo = {
      create: vi.fn(),
      findMaxWatchedSecondsByUserVideo: vi.fn(),
      findMaxWatchedSecondsByUserVideos: vi.fn(),
      findLatestCreatedAtByUserVideo: vi.fn(),
      sumWatchedSecondsByUserSubject: vi.fn(),
    } as Mocked<IViewingLogRepository>;

    mockSubjectProgressRepo = {
      findByUserSubject: vi.fn(),
      findAllByUser: vi.fn(),
      upsert: vi.fn(),
    } as Mocked<ISubjectProgressRepository>;

    mockVideoRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByIdWithSupervisors: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as Mocked<IVideoRepository>;

    mockCourseAccessService = {
      canAccessCourse: vi.fn().mockResolvedValue(true),
    } as Mocked<ICourseAccessService>;

    mockWatchChecker = {
      canWatchVideo: vi.fn().mockResolvedValue(true),
    };

    // 各テストで明示的に上書きしない限り、初回扱い (前回ログなし) を既定とする
    mockLogRepo.findLatestCreatedAtByUserVideo.mockResolvedValue(null);
    mockLogRepo.sumWatchedSecondsByUserSubject.mockResolvedValue(0);
    mockSubjectProgressRepo.upsert.mockResolvedValue({
      id: "p-1",
      userId: "user-1",
      subjectId: "subject-1",
      totalWatchedMinutes: 0,
      isFulfilled: false,
      updatedAt: new Date(),
    });

    service = new ViewingLogService(
      mockLogRepo,
      mockVideoRepo,
      mockSubjectProgressRepo,
      mockCourseAccessService,
      mockWatchChecker
    );
  });

  afterEach(() => {
    vi.useRealTimers();
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

    it("test_recordSession_course_access_denied_throws_VideoNotFoundError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockCourseAccessService.canAccessCourse.mockResolvedValue(false);

      await expect(service.recordSession(validInput)).rejects.toThrow(VideoNotFoundError);
    });

    it("test_recordSession_course_access_denied_skips_persistence", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockCourseAccessService.canAccessCourse.mockResolvedValue(false);

      await service.recordSession(validInput).catch(() => undefined);

      expect(mockLogRepo.create).not.toHaveBeenCalled();
      expect(mockSubjectProgressRepo.upsert).not.toHaveBeenCalled();
    });

    it("test_recordSession_video_not_published_throws_VideoNotFoundError", async () => {
      mockVideoRepo.findById.mockResolvedValue({ ...mockVideo, isPublished: false });

      await expect(service.recordSession(validInput)).rejects.toThrow(VideoNotFoundError);
    });

    it("test_recordSession_video_not_published_skips_persistence", async () => {
      mockVideoRepo.findById.mockResolvedValue({ ...mockVideo, isPublished: false });

      await service.recordSession(validInput).catch(() => undefined);

      expect(mockLogRepo.create).not.toHaveBeenCalled();
      expect(mockSubjectProgressRepo.upsert).not.toHaveBeenCalled();
    });

    it("test_recordSession_watch_permission_denied_throws_VideoNotFoundError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockWatchChecker.canWatchVideo.mockResolvedValue(false);

      await expect(service.recordSession(validInput)).rejects.toThrow(VideoNotFoundError);
    });

    it("test_recordSession_watch_permission_denied_skips_persistence", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockWatchChecker.canWatchVideo.mockResolvedValue(false);

      await service.recordSession(validInput).catch(() => undefined);

      expect(mockLogRepo.create).not.toHaveBeenCalled();
      expect(mockSubjectProgressRepo.upsert).not.toHaveBeenCalled();
    });

    it("test_recordSession_watchedSeconds_exceeds_duration_throws_BusinessError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await expect(service.recordSession({ ...validInput, watchedSeconds: 5000 })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_recordSession_negative_watchedSeconds_throws_BusinessError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await expect(service.recordSession({ ...validInput, watchedSeconds: -1 })).rejects.toThrow(
        BusinessError
      );
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

    it("test_recordSession_first_log_within_initial_limit_succeeds", async () => {
      // 初回ログ (前回 createdAt が null) も初回上限の範囲内なら通る
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockLogRepo.findLatestCreatedAtByUserVideo.mockResolvedValue(null);
      mockLogRepo.findMaxWatchedSecondsByUserVideo.mockResolvedValue(0);
      mockLogRepo.create.mockResolvedValue(mockLog);

      // 10 秒は初回上限 (VIEWING_LOG_BUFFER_SECONDS * 2 = 20 秒) 以内
      await expect(
        service.recordSession({ ...validInput, watchedSeconds: 10 })
      ).resolves.toBeDefined();
    });

    it("test_recordSession_first_log_exceeds_initial_limit_throws_BusinessError", async () => {
      // 初回偽装攻撃対策: 初回ログで watchedSeconds = duration を送って
      // 一度で全視聴扱いになるのを防ぐ
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockLogRepo.findLatestCreatedAtByUserVideo.mockResolvedValue(null);
      mockLogRepo.findMaxWatchedSecondsByUserVideo.mockResolvedValue(0);

      await expect(service.recordSession({ ...validInput, watchedSeconds: 3600 })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_recordSession_server_time_increment_too_large_throws_BusinessError", async () => {
      // 累積攻撃対策: クライアント時刻 (startedAt/endedAt) を 1 時間と偽装しても、
      // サーバー側の前回ログ createdAt が直近 (10 秒前) なら拒否される
      // サーバー側で 10 秒 * 1.5 + バッファ 10 = 25 秒が上限、+100 秒は不正
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockLogRepo.findMaxWatchedSecondsByUserVideo.mockResolvedValue(100);
      const tenSecondsAgo = new Date(NOW.getTime() - 10_000);
      mockLogRepo.findLatestCreatedAtByUserVideo.mockResolvedValue(tenSecondsAgo);

      await expect(
        service.recordSession({
          ...validInput,
          startedAt: new Date("2026-05-18T09:00:00.000Z"),
          endedAt: new Date("2026-05-18T10:00:00.000Z"),
          watchedSeconds: 200,
        })
      ).rejects.toThrow(BusinessError);
    });

    it("test_recordSession_server_time_increment_within_limit_succeeds", async () => {
      // サーバー側 10 秒経過で +10 秒進捗（等倍再生）は OK
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockLogRepo.findMaxWatchedSecondsByUserVideo.mockResolvedValue(100);
      const tenSecondsAgo = new Date(NOW.getTime() - 10_000);
      mockLogRepo.findLatestCreatedAtByUserVideo.mockResolvedValue(tenSecondsAgo);
      mockLogRepo.create.mockResolvedValue(mockLog);

      await expect(
        service.recordSession({ ...validInput, watchedSeconds: 110 })
      ).resolves.toBeDefined();
    });

    it("test_recordSession_watchedSeconds_below_max_succeeds", async () => {
      // 既存 max より小さい値は再視聴扱い、サーバー側上限チェックを通過
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockLogRepo.findMaxWatchedSecondsByUserVideo.mockResolvedValue(200);
      const tenSecondsAgo = new Date(NOW.getTime() - 10_000);
      mockLogRepo.findLatestCreatedAtByUserVideo.mockResolvedValue(tenSecondsAgo);
      mockLogRepo.create.mockResolvedValue(mockLog);

      await expect(
        service.recordSession({ ...validInput, watchedSeconds: 50 })
      ).resolves.toBeDefined();
    });
  });

  describe("recordSession - SubjectProgress sync", () => {
    it("test_recordSession_upserts_subject_progress_after_log_creation", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockLogRepo.findLatestCreatedAtByUserVideo.mockResolvedValue(null);
      mockLogRepo.findMaxWatchedSecondsByUserVideo.mockResolvedValue(0);
      mockLogRepo.create.mockResolvedValue(mockLog);
      mockLogRepo.sumWatchedSecondsByUserSubject.mockResolvedValue(180); // 3 分

      await service.recordSession({ ...validInput, watchedSeconds: 10 });

      expect(mockSubjectProgressRepo.upsert).toHaveBeenCalledWith(
        {
          userId: "user-1",
          subjectId: "subject-1",
          totalWatchedMinutes: 3,
          isFulfilled: false,
        },
        expect.anything()
      );
    });

    it("test_recordSession_throws_BusinessError_when_validation_fails", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await expect(service.recordSession({ ...validInput, watchedSeconds: -1 })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_recordSession_skips_upsert_when_validation_fails", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await service.recordSession({ ...validInput, watchedSeconds: -1 }).catch(() => undefined);

      expect(mockSubjectProgressRepo.upsert).not.toHaveBeenCalled();
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
