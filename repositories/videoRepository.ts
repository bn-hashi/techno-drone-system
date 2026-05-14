import { getPrisma } from "@/lib/db";
import { Video, VideoSupervisor } from "@prisma/client";

export type VideoWithSupervisors = Video & { supervisors: VideoSupervisor[] };

export interface VideoFilter {
  courseId?: string;
  subjectId?: string;
  isPublished?: boolean;
}

export interface CreateVideoInput {
  title: string;
  description?: string;
  subjectId: string;
  courseId: string;
  filePath: string;
  duration: number;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface UpdateVideoInput {
  title?: string;
  description?: string;
  subjectId?: string;
  courseId?: string;
  filePath?: string;
  duration?: number;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface IVideoRepository {
  /**
   * 動画一覧を取得する
   * @param filter - コース・科目・公開状態による絞り込み条件
   * @param limit - 取得上限（デフォルト: 500、全件取得によるメモリ消費を防ぐ）
   */
  findAll(filter?: VideoFilter, limit?: number): Promise<Video[]>;
  findById(id: string): Promise<Video | null>;
  /** 監修者情報を含む動画を取得する（法的必須項目確認用） */
  findByIdWithSupervisors(id: string): Promise<VideoWithSupervisors | null>;
  create(data: CreateVideoInput): Promise<Video>;
  update(id: string, data: UpdateVideoInput): Promise<Video>;
  delete(id: string): Promise<void>;
}

export class VideoRepository implements IVideoRepository {
  async findAll(filter?: VideoFilter, limit = 500): Promise<Video[]> {
    const prisma = getPrisma();
    const where: VideoFilter = {};
    if (filter?.courseId !== undefined) where.courseId = filter.courseId;
    if (filter?.subjectId !== undefined) where.subjectId = filter.subjectId;
    if (filter?.isPublished !== undefined) where.isPublished = filter.isPublished;
    return prisma.video.findMany({ where, take: limit });
  }

  async findById(id: string): Promise<Video | null> {
    const prisma = getPrisma();
    return prisma.video.findUnique({ where: { id } });
  }

  async findByIdWithSupervisors(id: string): Promise<VideoWithSupervisors | null> {
    const prisma = getPrisma();
    return prisma.video.findUnique({
      where: { id },
      include: { supervisors: true },
    });
  }

  async create(data: CreateVideoInput): Promise<Video> {
    const prisma = getPrisma();
    return prisma.video.create({ data });
  }

  async update(id: string, data: UpdateVideoInput): Promise<Video> {
    const prisma = getPrisma();
    return prisma.video.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.video.delete({ where: { id } });
  }
}
