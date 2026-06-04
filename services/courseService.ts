import type { Course } from "@prisma/client";
import type {
  ICourseRepository,
  CreateCourseInput,
  UpdateCourseInput,
} from "@/repositories/courseRepository";
import { BusinessError, CourseNotFoundError } from "@/services/errors";

export class CourseService {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async listCourses(): Promise<Course[]> {
    return this.courseRepo.findAll();
  }

  async getCourse(id: string): Promise<Course> {
    const course = await this.courseRepo.findById(id);
    if (course === null) {
      throw new CourseNotFoundError(id);
    }
    return course;
  }

  async createCourse(data: CreateCourseInput): Promise<Course> {
    const trimmedName = data.name.trim();
    if (trimmedName === "") {
      throw new BusinessError("コース名は必須です");
    }
    return this.courseRepo.create({ ...data, name: trimmedName });
  }

  async updateCourse(id: string, data: UpdateCourseInput): Promise<Course> {
    const course = await this.courseRepo.findById(id);
    if (course === null) {
      throw new CourseNotFoundError(id);
    }

    const normalized: UpdateCourseInput = { ...data };
    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (trimmedName === "") {
        throw new BusinessError("コース名は必須です");
      }
      normalized.name = trimmedName;
    }

    return this.courseRepo.update(id, normalized);
  }

  async deleteCourse(id: string): Promise<void> {
    const course = await this.courseRepo.findById(id);
    if (course === null) {
      throw new CourseNotFoundError(id);
    }
    await this.courseRepo.delete(id);
  }
}
