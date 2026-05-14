import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { CourseService } from "@/services/courseService";
import type { ICourseRepository } from "@/repositories/courseRepository";
import { CourseNotFoundError, BusinessError } from "@/services/errors";
import { CourseType } from "@/types/prisma";

describe("CourseService", () => {
  let service: CourseService;
  let mockCourseRepo: Mocked<ICourseRepository>;

  const mockCourse = {
    id: "course-1",
    name: "初学者コース",
    type: CourseType.BEGINNER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockCourseRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as Mocked<ICourseRepository>;

    service = new CourseService(mockCourseRepo);
  });

  describe("listCourses", () => {
    it("test_listCourses_returns_all_courses", async () => {
      mockCourseRepo.findAll.mockResolvedValue([mockCourse]);

      const result = await service.listCourses();

      expect(result).toEqual([mockCourse]);
      expect(mockCourseRepo.findAll).toHaveBeenCalledOnce();
    });

    it("test_listCourses_empty_returns_empty_array", async () => {
      mockCourseRepo.findAll.mockResolvedValue([]);

      const result = await service.listCourses();

      expect(result).toEqual([]);
    });
  });

  describe("getCourse", () => {
    it("test_getCourse_existing_id_returns_course", async () => {
      mockCourseRepo.findById.mockResolvedValue(mockCourse);

      const result = await service.getCourse("course-1");

      expect(result).toEqual(mockCourse);
    });

    it("test_getCourse_nonexistent_id_throws_CourseNotFoundError", async () => {
      mockCourseRepo.findById.mockResolvedValue(null);

      await expect(service.getCourse("nonexistent")).rejects.toThrow(CourseNotFoundError);
    });
  });

  describe("createCourse", () => {
    it("test_createCourse_valid_data_returns_created_course", async () => {
      mockCourseRepo.create.mockResolvedValue(mockCourse);

      const result = await service.createCourse({ name: "初学者コース", type: CourseType.BEGINNER });

      expect(result).toEqual(mockCourse);
      expect(mockCourseRepo.create).toHaveBeenCalledWith({
        name: "初学者コース",
        type: CourseType.BEGINNER,
      });
    });

    it("test_createCourse_empty_name_throws_BusinessError", async () => {
      await expect(
        service.createCourse({ name: "", type: CourseType.BEGINNER })
      ).rejects.toThrow(BusinessError);
    });

    it("test_createCourse_whitespace_only_name_throws_BusinessError", async () => {
      await expect(
        service.createCourse({ name: "   ", type: CourseType.BEGINNER })
      ).rejects.toThrow(BusinessError);
    });
  });

  describe("updateCourse", () => {
    it("test_updateCourse_existing_id_returns_updated_course", async () => {
      const updated = { ...mockCourse, name: "改訂版コース" };
      mockCourseRepo.findById.mockResolvedValue(mockCourse);
      mockCourseRepo.update.mockResolvedValue(updated);

      const result = await service.updateCourse("course-1", { name: "改訂版コース" });

      expect(result).toEqual(updated);
    });

    it("test_updateCourse_nonexistent_id_throws_CourseNotFoundError", async () => {
      mockCourseRepo.findById.mockResolvedValue(null);

      await expect(service.updateCourse("nonexistent", { name: "test" })).rejects.toThrow(
        CourseNotFoundError
      );
    });

    it("test_updateCourse_empty_name_throws_BusinessError", async () => {
      mockCourseRepo.findById.mockResolvedValue(mockCourse);

      await expect(service.updateCourse("course-1", { name: "" })).rejects.toThrow(BusinessError);
    });
  });

  describe("deleteCourse", () => {
    it("test_deleteCourse_existing_id_calls_delete", async () => {
      mockCourseRepo.findById.mockResolvedValue(mockCourse);
      mockCourseRepo.delete.mockResolvedValue(undefined);

      await service.deleteCourse("course-1");

      expect(mockCourseRepo.delete).toHaveBeenCalledWith("course-1");
    });

    it("test_deleteCourse_nonexistent_id_throws_CourseNotFoundError", async () => {
      mockCourseRepo.findById.mockResolvedValue(null);

      await expect(service.deleteCourse("nonexistent")).rejects.toThrow(CourseNotFoundError);
    });
  });
});
