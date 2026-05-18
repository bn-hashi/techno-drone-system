import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { VideoService } from "@/services/videoService";
import type { IVideoRepository } from "@/repositories/videoRepository";
import type { IVideoSupervisorRepository } from "@/repositories/videoSupervisorRepository";
import { VideoNotFoundError, SupervisorNotFoundError, BusinessError } from "@/services/errors";

describe("VideoService", () => {
  let service: VideoService;
  let mockVideoRepo: Mocked<IVideoRepository>;
  let mockSupervisorRepo: Mocked<IVideoSupervisorRepository>;

  const mockSupervisor = {
    id: "supervisor-1",
    videoId: "video-1",
    name: "山田太郎",
    instructorRegistrationNumber: "REG-001",
  };

  const mockVideo = {
    id: "video-1",
    title: "ドローン基礎講座",
    description: "基礎から学ぶ",
    subjectId: "subject-1",
    courseId: "course-1",
    filePath: "/videos/drone-basic.mp4",
    duration: 3600,
    sortOrder: 1,
    isPublished: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVideoWithSupervisors = {
    ...mockVideo,
    supervisors: [mockSupervisor],
  };

  const mockVideoWithNoSupervisors = {
    ...mockVideo,
    supervisors: [],
  };

  beforeEach(() => {
    mockVideoRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByIdWithSupervisors: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as Mocked<IVideoRepository>;

    mockSupervisorRepo = {
      findByVideoId: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as Mocked<IVideoSupervisorRepository>;

    service = new VideoService(mockVideoRepo, mockSupervisorRepo);
  });

  describe("listVideos", () => {
    it("test_listVideos_no_filter_returns_all_videos", async () => {
      mockVideoRepo.findAll.mockResolvedValue([mockVideo]);

      const result = await service.listVideos();

      expect(result).toEqual([mockVideo]);
    });

    it("test_listVideos_no_filter_calls_repo_with_undefined", async () => {
      mockVideoRepo.findAll.mockResolvedValue([mockVideo]);

      await service.listVideos();

      expect(mockVideoRepo.findAll).toHaveBeenCalledWith(undefined);
    });

    it("test_listVideos_with_filter_passes_filter_to_repo", async () => {
      mockVideoRepo.findAll.mockResolvedValue([mockVideo]);

      await service.listVideos({ courseId: "course-1" });

      expect(mockVideoRepo.findAll).toHaveBeenCalledWith({ courseId: "course-1" });
    });

    it("test_listVideos_empty_returns_empty_array", async () => {
      mockVideoRepo.findAll.mockResolvedValue([]);

      const result = await service.listVideos();

      expect(result).toEqual([]);
    });
  });

  describe("getVideo", () => {
    it("test_getVideo_existing_id_returns_video", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      const result = await service.getVideo("video-1");

      expect(result).toEqual(mockVideo);
    });

    it("test_getVideo_nonexistent_id_throws_VideoNotFoundError", async () => {
      mockVideoRepo.findById.mockResolvedValue(null);

      await expect(service.getVideo("nonexistent")).rejects.toThrow(VideoNotFoundError);
    });
  });

  describe("createVideo", () => {
    const createInput = {
      title: "ドローン基礎講座",
      subjectId: "subject-1",
      courseId: "course-1",
      filePath: "/videos/drone-basic.mp4",
      duration: 3600,
    };

    it("test_createVideo_valid_data_returns_created_video", async () => {
      mockVideoRepo.create.mockResolvedValue(mockVideo);

      const result = await service.createVideo(createInput);

      expect(result).toEqual(mockVideo);
    });

    it("test_createVideo_valid_data_calls_repo_create_with_input", async () => {
      mockVideoRepo.create.mockResolvedValue(mockVideo);

      await service.createVideo(createInput);

      expect(mockVideoRepo.create).toHaveBeenCalledWith(createInput);
    });

    it("test_createVideo_empty_title_throws_BusinessError", async () => {
      await expect(service.createVideo({ ...createInput, title: "" })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_createVideo_negative_duration_throws_BusinessError", async () => {
      await expect(service.createVideo({ ...createInput, duration: -1 })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_createVideo_zero_duration_throws_BusinessError", async () => {
      await expect(service.createVideo({ ...createInput, duration: 0 })).rejects.toThrow(
        BusinessError
      );
    });
  });

  describe("updateVideo", () => {
    it("test_updateVideo_nonexistent_id_throws_VideoNotFoundError", async () => {
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(null);

      await expect(service.updateVideo("nonexistent", { title: "test" })).rejects.toThrow(
        VideoNotFoundError
      );
    });

    it("test_updateVideo_valid_data_returns_updated_video", async () => {
      const updated = { ...mockVideo, title: "更新後タイトル" };
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(mockVideoWithSupervisors);
      mockVideoRepo.update.mockResolvedValue(updated);

      const result = await service.updateVideo("video-1", { title: "更新後タイトル" });

      expect(result).toEqual(updated);
    });

    it("test_updateVideo_publish_with_supervisor_succeeds", async () => {
      const updated = { ...mockVideo, isPublished: true };
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(mockVideoWithSupervisors);
      mockVideoRepo.update.mockResolvedValue(updated);

      const result = await service.updateVideo("video-1", { isPublished: true });

      expect(result.isPublished).toBe(true);
    });

    it("test_updateVideo_publish_without_supervisor_throws_BusinessError", async () => {
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(mockVideoWithNoSupervisors);

      await expect(service.updateVideo("video-1", { isPublished: true })).rejects.toThrow(
        BusinessError
      );
    });

    it("test_updateVideo_empty_title_throws_BusinessError", async () => {
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(mockVideoWithSupervisors);

      await expect(service.updateVideo("video-1", { title: "  " })).rejects.toThrow(BusinessError);
    });

    it("test_updateVideo_zero_duration_throws_BusinessError", async () => {
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(mockVideoWithSupervisors);

      await expect(service.updateVideo("video-1", { duration: 0 })).rejects.toThrow(BusinessError);
    });

    it("test_updateVideo_negative_duration_throws_BusinessError", async () => {
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(mockVideoWithSupervisors);

      await expect(service.updateVideo("video-1", { duration: -1 })).rejects.toThrow(BusinessError);
    });
  });

  describe("deleteVideo", () => {
    it("test_deleteVideo_existing_id_calls_delete", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockVideoRepo.delete.mockResolvedValue(undefined);

      await service.deleteVideo("video-1");

      expect(mockVideoRepo.delete).toHaveBeenCalledWith("video-1");
    });

    it("test_deleteVideo_nonexistent_id_throws_VideoNotFoundError", async () => {
      mockVideoRepo.findById.mockResolvedValue(null);

      await expect(service.deleteVideo("nonexistent")).rejects.toThrow(VideoNotFoundError);
    });
  });

  describe("addSupervisor", () => {
    const supervisorInput = {
      name: "山田太郎",
      instructorRegistrationNumber: "REG-001",
    };

    it("test_addSupervisor_video_not_found_throws_VideoNotFoundError", async () => {
      mockVideoRepo.findById.mockResolvedValue(null);

      await expect(service.addSupervisor("nonexistent", supervisorInput)).rejects.toThrow(
        VideoNotFoundError
      );
    });

    it("test_addSupervisor_valid_data_returns_created_supervisor", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockSupervisorRepo.create.mockResolvedValue(mockSupervisor);

      const result = await service.addSupervisor("video-1", supervisorInput);

      expect(result).toEqual(mockSupervisor);
    });

    it("test_addSupervisor_valid_data_calls_repo_create_with_videoId", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);
      mockSupervisorRepo.create.mockResolvedValue(mockSupervisor);

      await service.addSupervisor("video-1", supervisorInput);

      expect(mockSupervisorRepo.create).toHaveBeenCalledWith({
        videoId: "video-1",
        ...supervisorInput,
      });
    });

    it("test_addSupervisor_empty_name_throws_BusinessError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await expect(
        service.addSupervisor("video-1", { name: "", instructorRegistrationNumber: "REG-001" })
      ).rejects.toThrow(BusinessError);
    });

    it("test_addSupervisor_empty_instructorRegistrationNumber_throws_BusinessError", async () => {
      mockVideoRepo.findById.mockResolvedValue(mockVideo);

      await expect(
        service.addSupervisor("video-1", { name: "山田太郎", instructorRegistrationNumber: "  " })
      ).rejects.toThrow(BusinessError);
    });
  });

  describe("updateSupervisor", () => {
    it("test_updateSupervisor_nonexistent_id_throws_SupervisorNotFoundError", async () => {
      mockSupervisorRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateSupervisor("video-1", "nonexistent", { name: "新名前" })
      ).rejects.toThrow(SupervisorNotFoundError);
    });

    it("test_updateSupervisor_supervisor_belongs_to_other_video_throws_SupervisorNotFoundError", async () => {
      mockSupervisorRepo.findById.mockResolvedValue({
        ...mockSupervisor,
        videoId: "other-video",
      });

      await expect(
        service.updateSupervisor("video-1", "supervisor-1", { name: "新名前" })
      ).rejects.toThrow(SupervisorNotFoundError);
    });

    it("test_updateSupervisor_valid_data_returns_updated_supervisor", async () => {
      const updated = { ...mockSupervisor, name: "鈴木花子" };
      mockSupervisorRepo.findById.mockResolvedValue(mockSupervisor);
      mockSupervisorRepo.update.mockResolvedValue(updated);

      const result = await service.updateSupervisor("video-1", "supervisor-1", {
        name: "鈴木花子",
      });

      expect(result).toEqual(updated);
    });

    it("test_updateSupervisor_empty_name_throws_BusinessError", async () => {
      mockSupervisorRepo.findById.mockResolvedValue(mockSupervisor);

      await expect(
        service.updateSupervisor("video-1", "supervisor-1", { name: "  " })
      ).rejects.toThrow(BusinessError);
    });

    it("test_updateSupervisor_empty_instructorRegistrationNumber_throws_BusinessError", async () => {
      mockSupervisorRepo.findById.mockResolvedValue(mockSupervisor);

      await expect(
        service.updateSupervisor("video-1", "supervisor-1", {
          instructorRegistrationNumber: "  ",
        })
      ).rejects.toThrow(BusinessError);
    });
  });

  describe("removeSupervisor", () => {
    it("test_removeSupervisor_nonexistent_id_throws_SupervisorNotFoundError", async () => {
      mockSupervisorRepo.findById.mockResolvedValue(null);

      await expect(service.removeSupervisor("video-1", "nonexistent")).rejects.toThrow(
        SupervisorNotFoundError
      );
    });

    it("test_removeSupervisor_supervisor_belongs_to_other_video_throws_SupervisorNotFoundError", async () => {
      mockSupervisorRepo.findById.mockResolvedValue({
        ...mockSupervisor,
        videoId: "other-video",
      });

      await expect(service.removeSupervisor("video-1", "supervisor-1")).rejects.toThrow(
        SupervisorNotFoundError
      );
    });

    it("test_removeSupervisor_valid_id_calls_delete", async () => {
      mockSupervisorRepo.findById.mockResolvedValue(mockSupervisor);
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(mockVideoWithSupervisors);
      mockSupervisorRepo.delete.mockResolvedValue(undefined);

      await service.removeSupervisor("video-1", "supervisor-1");

      expect(mockSupervisorRepo.delete).toHaveBeenCalledWith("supervisor-1");
    });

    it("test_removeSupervisor_last_supervisor_of_published_video_throws_BusinessError", async () => {
      const publishedVideo = { ...mockVideoWithSupervisors, isPublished: true };
      mockSupervisorRepo.findById.mockResolvedValue(mockSupervisor);
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(publishedVideo);

      await expect(service.removeSupervisor("video-1", "supervisor-1")).rejects.toThrow(
        BusinessError
      );
    });

    it("test_removeSupervisor_last_supervisor_of_unpublished_video_succeeds", async () => {
      mockSupervisorRepo.findById.mockResolvedValue(mockSupervisor);
      mockVideoRepo.findByIdWithSupervisors.mockResolvedValue(mockVideoWithSupervisors);
      mockSupervisorRepo.delete.mockResolvedValue(undefined);

      await service.removeSupervisor("video-1", "supervisor-1");

      expect(mockSupervisorRepo.delete).toHaveBeenCalledWith("supervisor-1");
    });
  });
});
