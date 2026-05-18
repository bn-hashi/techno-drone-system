import { getPrisma } from "@/lib/db";
import { Course } from "@prisma/client";
import { CourseType } from "@/types/prisma";

export interface CreateCourseInput {
  name: string;
  type: CourseType;
}

export interface UpdateCourseInput {
  name?: string;
  type?: CourseType;
}

export interface ICourseRepository {
  /**
   * コース一覧を取得する
   * @param limit - 取得上限（デフォルト: 500、全件取得によるメモリ消費を防ぐ）
   */
  findAll(limit?: number): Promise<Course[]>;
  findById(id: string): Promise<Course | null>;
  create(data: CreateCourseInput): Promise<Course>;
  update(id: string, data: UpdateCourseInput): Promise<Course>;
  delete(id: string): Promise<void>;
}

export class CourseRepository implements ICourseRepository {
  async findAll(limit = 500): Promise<Course[]> {
    const prisma = getPrisma();
    return prisma.course.findMany({ take: limit });
  }

  async findById(id: string): Promise<Course | null> {
    const prisma = getPrisma();
    return prisma.course.findUnique({ where: { id } });
  }

  async create(data: CreateCourseInput): Promise<Course> {
    const prisma = getPrisma();
    return prisma.course.create({ data });
  }

  async update(id: string, data: UpdateCourseInput): Promise<Course> {
    const prisma = getPrisma();
    return prisma.course.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.course.delete({ where: { id } });
  }
}
