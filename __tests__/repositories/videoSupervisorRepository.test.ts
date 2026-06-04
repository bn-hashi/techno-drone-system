import { describe, it, expect, beforeEach, vi } from "vitest";
import { VideoSupervisorRepository } from "@/repositories/videoSupervisorRepository";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    videoSupervisor: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  }),
}));

describe("VideoSupervisorRepository", () => {
  let repository: VideoSupervisorRepository;

  const mockSupervisor = {
    id: "supervisor-1",
    videoId: "video-1",
    name: "山田太郎",
    instructorRegistrationNumber: "REG-001",
  };

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    repository = new VideoSupervisorRepository();
  });

  describe("findByVideoId", () => {
    it("test_findByVideoId_existing_video_returns_supervisors", async () => {
      mockFindMany.mockResolvedValue([mockSupervisor]);

      const result = await repository.findByVideoId("video-1");

      expect(result).toEqual([mockSupervisor]);
    });

    it("test_findByVideoId_calls_prisma_with_videoId", async () => {
      mockFindMany.mockResolvedValue([mockSupervisor]);

      await repository.findByVideoId("video-1");

      expect(mockFindMany).toHaveBeenCalledWith({ where: { videoId: "video-1" } });
    });

    it("test_findByVideoId_no_supervisors_returns_empty_array", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await repository.findByVideoId("video-1");

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("test_findById_existing_id_returns_supervisor", async () => {
      mockFindUnique.mockResolvedValue(mockSupervisor);

      const result = await repository.findById("supervisor-1");

      expect(result).toEqual(mockSupervisor);
    });

    it("test_findById_calls_prisma_with_id", async () => {
      mockFindUnique.mockResolvedValue(mockSupervisor);

      await repository.findById("supervisor-1");

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "supervisor-1" } });
    });

    it("test_findById_nonexistent_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    const createInput = {
      videoId: "video-1",
      name: "山田太郎",
      instructorRegistrationNumber: "REG-001",
    };

    it("test_create_valid_data_returns_created_supervisor", async () => {
      mockCreate.mockResolvedValue(mockSupervisor);

      const result = await repository.create(createInput);

      expect(result).toEqual(mockSupervisor);
    });

    it("test_create_calls_prisma_with_data", async () => {
      mockCreate.mockResolvedValue(mockSupervisor);

      await repository.create(createInput);

      expect(mockCreate).toHaveBeenCalledWith({ data: createInput });
    });
  });

  describe("update", () => {
    it("test_update_returns_updated_supervisor", async () => {
      const updated = { ...mockSupervisor, name: "鈴木花子" };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.update("supervisor-1", { name: "鈴木花子" });

      expect(result).toEqual(updated);
    });

    it("test_update_calls_prisma_with_correct_args", async () => {
      mockUpdate.mockResolvedValue(mockSupervisor);

      await repository.update("supervisor-1", { instructorRegistrationNumber: "REG-999" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "supervisor-1" },
        data: { instructorRegistrationNumber: "REG-999" },
      });
    });
  });

  describe("delete", () => {
    it("test_delete_calls_prisma_delete_with_id", async () => {
      mockDelete.mockResolvedValue(mockSupervisor);

      await repository.delete("supervisor-1");

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "supervisor-1" } });
    });
  });
});
