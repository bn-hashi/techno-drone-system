import { describe, it, expect, beforeEach, vi } from "vitest";
import { VideoRepository } from "@/repositories/videoRepository";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    video: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  }),
}));

describe("VideoRepository", () => {
  let repository: VideoRepository;

  const mockVideo = {
    id: "video-1",
    title: "はじめての操縦",
    description: "基本操縦を学ぶ",
    subjectId: "subject-1",
    courseId: "course-1",
    filePath: "basic/intro.mp4",
    duration: 600,
    sortOrder: 1,
    isPublished: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  const mockSupervisor = {
    id: "supervisor-1",
    videoId: "video-1",
    name: "山田太郎",
    instructorRegistrationNumber: "REG-001",
  };

  const mockVideoWithSupervisors = { ...mockVideo, supervisors: [mockSupervisor] };

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    repository = new VideoRepository();
  });

  describe("findAll", () => {
    it("test_findAll_no_filter_returns_videos_within_limit", async () => {
      mockFindMany.mockResolvedValue([mockVideo]);

      const result = await repository.findAll();

      expect(result).toEqual([mockVideo]);
      expect(mockFindMany).toHaveBeenCalledWith({ where: {}, take: 500 });
    });

    it("test_findAll_with_courseId_filter", async () => {
      mockFindMany.mockResolvedValue([mockVideo]);

      await repository.findAll({ courseId: "course-1" });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { courseId: "course-1" },
        take: 500,
      });
    });

    it("test_findAll_with_subjectId_filter", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll({ subjectId: "subject-1" });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { subjectId: "subject-1" },
        take: 500,
      });
    });

    it("test_findAll_with_isPublished_filter", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll({ isPublished: true });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isPublished: true },
        take: 500,
      });
    });

    it("test_findAll_with_custom_limit", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll(undefined, 10);

      expect(mockFindMany).toHaveBeenCalledWith({ where: {}, take: 10 });
    });
  });

  describe("findById", () => {
    it("test_findById_existing_id_returns_video", async () => {
      mockFindUnique.mockResolvedValue(mockVideo);

      const result = await repository.findById("video-1");

      expect(result).toEqual(mockVideo);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "video-1" } });
    });

    it("test_findById_nonexistent_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByIdWithSupervisors", () => {
    it("test_findByIdWithSupervisors_existing_id_returns_video_with_supervisors", async () => {
      mockFindUnique.mockResolvedValue(mockVideoWithSupervisors);

      const result = await repository.findByIdWithSupervisors("video-1");

      expect(result).toEqual(mockVideoWithSupervisors);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "video-1" },
        include: { supervisors: true },
      });
    });

    it("test_findByIdWithSupervisors_nonexistent_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findByIdWithSupervisors("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    const createInput = {
      title: "はじめての操縦",
      subjectId: "subject-1",
      courseId: "course-1",
      filePath: "basic/intro.mp4",
      duration: 600,
    };

    it("test_create_valid_data_returns_created_video", async () => {
      mockCreate.mockResolvedValue(mockVideo);

      const result = await repository.create(createInput);

      expect(result).toEqual(mockVideo);
    });

    it("test_create_calls_prisma_with_data", async () => {
      mockCreate.mockResolvedValue(mockVideo);

      await repository.create(createInput);

      expect(mockCreate).toHaveBeenCalledWith({ data: createInput });
    });
  });

  describe("update", () => {
    it("test_update_returns_updated_video", async () => {
      const updated = { ...mockVideo, title: "更新後タイトル" };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.update("video-1", { title: "更新後タイトル" });

      expect(result).toEqual(updated);
    });

    it("test_update_calls_prisma_with_correct_args", async () => {
      mockUpdate.mockResolvedValue(mockVideo);

      await repository.update("video-1", { isPublished: true });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "video-1" },
        data: { isPublished: true },
      });
    });
  });

  describe("delete", () => {
    it("test_delete_calls_prisma_delete_with_id", async () => {
      mockDelete.mockResolvedValue(mockVideo);

      await repository.delete("video-1");

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "video-1" } });
    });
  });
});
