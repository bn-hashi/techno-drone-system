import { describe, it, expect, beforeEach, vi } from "vitest";
import { CourseRepository } from "@/repositories/courseRepository";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    course: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  }),
}));

describe("CourseRepository", () => {
  let repository: CourseRepository;

  const mockCourse = {
    id: "course-1",
    name: "初学者コース",
    type: "BEGINNER" as const,
  };

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    repository = new CourseRepository();
  });

  describe("findAll", () => {
    it("test_findAll_returns_courses_within_limit", async () => {
      mockFindMany.mockResolvedValue([mockCourse]);

      const result = await repository.findAll();

      expect(result).toEqual([mockCourse]);
      expect(mockFindMany).toHaveBeenCalledWith({ take: 500 });
    });

    it("test_findAll_with_custom_limit", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll(10);

      expect(mockFindMany).toHaveBeenCalledWith({ take: 10 });
    });
  });

  describe("findById", () => {
    it("test_findById_existing_id_returns_course", async () => {
      mockFindUnique.mockResolvedValue(mockCourse);

      const result = await repository.findById("course-1");

      expect(result).toEqual(mockCourse);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "course-1" } });
    });

    it("test_findById_nonexistent_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("test_create_valid_data_returns_created_course", async () => {
      mockCreate.mockResolvedValue(mockCourse);

      const result = await repository.create({ name: "初学者コース", type: "BEGINNER" });

      expect(result).toEqual(mockCourse);
    });

    it("test_create_calls_prisma_with_data", async () => {
      mockCreate.mockResolvedValue(mockCourse);

      await repository.create({ name: "初学者コース", type: "BEGINNER" });

      expect(mockCreate).toHaveBeenCalledWith({
        data: { name: "初学者コース", type: "BEGINNER" },
      });
    });
  });

  describe("update", () => {
    it("test_update_returns_updated_course", async () => {
      const updated = { ...mockCourse, name: "更新後コース名" };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.update("course-1", { name: "更新後コース名" });

      expect(result).toEqual(updated);
    });

    it("test_update_calls_prisma_with_correct_args", async () => {
      mockUpdate.mockResolvedValue(mockCourse);

      await repository.update("course-1", { name: "更新後コース名" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "course-1" },
        data: { name: "更新後コース名" },
      });
    });
  });

  describe("delete", () => {
    it("test_delete_calls_prisma_delete_with_id", async () => {
      mockDelete.mockResolvedValue(mockCourse);

      await repository.delete("course-1");

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "course-1" } });
    });
  });
});
